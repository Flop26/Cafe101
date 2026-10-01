import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mysql from 'mysql2/promise';

const app = express();
const port = Number(process.env.PORT || 3000);
const defaultCustomerId = 1;
const defaultEmployeeId = 1;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

app.use(cors());
app.use(express.json());

app.get('/api/state', async (_request, response, next) => {
  try {
    const [menuRows] = await pool.query(`
      SELECT
        mi.Menu_Item_ID,
        mi.Item_Name,
        mi.Description,
        mi.Price,
        mi.Availability,
        mi.Image_URI,
        c.Category_Name,
        c.Supports_Size,
        ri.Recipe_ID,
        ri.Inventory_ID,
        ri.Required_Quantity,
        inv.Inventory_Name,
        inv.Unit
      FROM Menu_Item mi
      JOIN Category c ON c.Category_ID = mi.Category_ID
      LEFT JOIN Recipe_Item ri ON ri.Menu_Item_ID = mi.Menu_Item_ID
      LEFT JOIN Inventory inv ON inv.Inventory_ID = ri.Inventory_ID
      ORDER BY mi.Menu_Item_ID, ri.Recipe_ID
    `);
    const [inventoryRows] = await pool.query('SELECT * FROM Inventory ORDER BY Inventory_ID');
    const [categoryRows] = await pool.query('SELECT * FROM Category ORDER BY Category_ID');

    response.json({
      menuItems: buildMenuItems(menuRows),
      inventoryItems: inventoryRows.map(inventoryFromRow),
      categories: categoryRows.map(categoryFromRow),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/menu', async (request, response, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const item = await saveMenuItem(connection, request.body);
    await connection.commit();
    response.status(201).json(item);
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.put('/api/menu/:id', async (request, response, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const item = await saveMenuItem(connection, { ...request.body, id: request.params.id });
    await connection.commit();
    response.json(item);
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.delete('/api/menu/:id', async (request, response, next) => {
  try {
    const itemId = request.params.id;
    const [orderRows] = await pool.query(
      'SELECT COUNT(*) AS count FROM Orders_Item WHERE Menu_Item_ID = ?',
      [itemId],
    );

    // Items with order history are archived so past receipts stay intact
    if (Number(orderRows[0].count) > 0) {
      await pool.query('UPDATE Menu_Item SET Availability = 0 WHERE Menu_Item_ID = ?', [itemId]);
      return response.sendStatus(204);
    }

    await pool.query('DELETE FROM Recipe_Item WHERE Menu_Item_ID = ?', [itemId]);
    await pool.query('DELETE FROM Menu_Item WHERE Menu_Item_ID = ?', [itemId]);
    response.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/inventory/:id', async (request, response, next) => {
  try {
    await saveInventoryItem(pool, request.params.id, request.body);
    response.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/inventory/:id', async (request, response, next) => {
  try {
    const id = String(request.params.id || '').trim();
    const [recipes] = await pool.query('SELECT COUNT(*) AS count FROM Recipe_Item WHERE Inventory_ID = ?', [id]);
    if (recipes[0].count > 0) {
      return response.status(409).json({ message: 'This item is used in a recipe. Remove it from the recipe first.' });
    }
    await pool.query('DELETE FROM Inventory WHERE Inventory_ID = ?', [id]);
    response.sendStatus(204);
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return response.status(409).json({ message: 'This item has spillage records and cannot be deleted.' });
    }
    next(error);
  }
});

app.post('/api/orders', async (request, response, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { order, requirements } = request.body;
    const validRequirements = getValidRequirements(requirements);

    await ensureDefaultActors(connection);

    for (const requirement of validRequirements) {
      const [rows] = await connection.query(
        'SELECT Quantity_On_Hand FROM Inventory WHERE Inventory_ID = ? FOR UPDATE',
        [requirement.id],
      );
      if (!rows.length || Number(rows[0].Quantity_On_Hand) < requirement.amount) {
        await connection.rollback();
        return response.status(409).json({ message: `Not enough stock for ${requirement.name}.` });
      }
    }

    for (const requirement of validRequirements) {
      await connection.query(
        'UPDATE Inventory SET Quantity_On_Hand = Quantity_On_Hand - ? WHERE Inventory_ID = ?',
        [requirement.amount, requirement.id],
      );
    }

    const paidAt = new Date(order.paidAt || order.createdAt || Date.now());
    await connection.query(
      `INSERT INTO Orders (Order_ID, Customer_ID, Employee_ID, Order_Date, Total_Amount, Status)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE Total_Amount = VALUES(Total_Amount), Status = VALUES(Status)`,
      [order.id, defaultCustomerId, defaultEmployeeId, paidAt, order.subtotal, 'Paid'],
    );

    await connection.query('DELETE FROM Orders_Item WHERE Order_ID = ?', [order.id]);
    for (const item of getValidOrderItems(order.items)) {
      await connection.query(
        `INSERT INTO Orders_Item (Order_ID, Menu_Item_ID, Quantity, Unit_Price, Subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [order.id, item.id, item.quantity, item.price, item.lineTotal],
      );
    }

    await connection.query(
      `INSERT INTO Payment_Item (Payment_ID, Order_ID, Payment_Date, Amount, Payment_Method, Status, Transaction_Reference)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE Payment_Date = VALUES(Payment_Date), Amount = VALUES(Amount), Payment_Method = VALUES(Payment_Method), Status = VALUES(Status), Transaction_Reference = VALUES(Transaction_Reference)`,
      [`payment-${order.id}`, order.id, paidAt, order.subtotal, order.paymentMethod, 'Paid', order.orderNumber || null],
    );

    await connection.commit();
    response.status(201).json(order);
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.post('/api/spillage', async (request, response, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await ensureDefaultActors(connection);

    const quantityWasted = Number.parseFloat(request.body.quantityWasted);
    if (!request.body.inventoryId || !Number.isFinite(quantityWasted) || quantityWasted <= 0) {
      await connection.rollback();
      return response.status(400).json({ message: 'Inventory item and quantity wasted are required.' });
    }

    await connection.query(
      `INSERT INTO Spillage_Log (Inventory_ID, Employee_ID, Quantity_Wasted, Reason, Logged_At)
       VALUES (?, ?, ?, ?, ?)`,
      [
        request.body.inventoryId,
        request.body.employeeId || defaultEmployeeId,
        quantityWasted,
        request.body.reason || null,
        request.body.loggedAt ? new Date(request.body.loggedAt) : new Date(),
      ],
    );
    await connection.query(
      'UPDATE Inventory SET Quantity_On_Hand = GREATEST(0, Quantity_On_Hand - ?) WHERE Inventory_ID = ?',
      [quantityWasted, request.body.inventoryId],
    );

    await connection.commit();
    response.sendStatus(201);
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.get('/api/categories', async (_request, response, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Category ORDER BY Category_ID');
    response.json(rows.map(categoryFromRow));
  } catch (error) {
    next(error);
  }
});

app.post('/api/categories', async (request, response, next) => {
  try {
    const name = String(request.body.name || '').trim();
    const description = String(request.body.description || '').trim();
    const supportsSize = Boolean(request.body.supportsSize);
    if (!name) return response.status(400).json({ message: 'Category name is required.' });

    const [result] = await pool.query(
      'INSERT INTO Category (Category_Name, Description, Supports_Size) VALUES (?, ?, ?)',
      [name, description || `${name} menu items`, supportsSize ? 1 : 0],
    );
    response.status(201).json({ id: result.insertId, name, description: description || `${name} menu items`, supportsSize });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return response.status(409).json({ message: `Category "${request.body.name}" already exists.` });
    }
    next(error);
  }
});

app.put('/api/categories/:id', async (request, response, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Category WHERE Category_ID = ?', [Number(request.params.id)]);
    if (!rows.length) return response.status(404).json({ message: 'Category not found.' });
    const existing = rows[0];

    const name = String(request.body.name ?? existing.Category_Name).trim();
    const description = String(request.body.description ?? existing.Description ?? '').trim();
    const supportsSize = request.body.supportsSize === undefined
      ? Boolean(existing.Supports_Size)
      : Boolean(request.body.supportsSize);
    if (!name) return response.status(400).json({ message: 'Category name is required.' });

    await pool.query(
      'UPDATE Category SET Category_Name = ?, Description = ?, Supports_Size = ? WHERE Category_ID = ?',
      [name, description || `${name} menu items`, supportsSize ? 1 : 0, existing.Category_ID],
    );
    response.sendStatus(204);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return response.status(409).json({ message: `Category "${request.body.name}" already exists.` });
    }
    next(error);
  }
});

app.delete('/api/categories/:id', async (request, response, next) => {
  try {
    const categoryId = Number(request.params.id);
    const [items] = await pool.query('SELECT COUNT(*) AS count FROM Menu_Item WHERE Category_ID = ?', [categoryId]);
    if (items[0].count > 0) {
      return response.status(409).json({ message: 'Cannot delete a category that still has menu items. Remove or reassign items first.' });
    }
    await pool.query('DELETE FROM Category WHERE Category_ID = ?', [categoryId]);
    response.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

app.get('/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1');
    response.json({ ok: true });
  } catch {
    response.status(503).json({ ok: false });
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ message: 'Database request failed.' });
});

app.listen(port, () => console.log(`Cafe101 API listening on http://localhost:${port}`));

function buildMenuItems(rows) {
  const itemsById = new Map();

  for (const row of rows) {
    if (!itemsById.has(row.Menu_Item_ID)) {
      itemsById.set(row.Menu_Item_ID, {
        id: row.Menu_Item_ID,
        name: row.Item_Name,
        category: row.Category_Name,
        description: row.Description || '',
        price: Number(row.Price),
        accent: getCategoryAccent(row.Category_Name),
        options: getOptionType(row.Category_Name, row.Supports_Size),
        ingredients: [],
        measurementAmount: null,
        measurementUnit: null,
        imageUri: row.Image_URI || '',
        availability: Boolean(row.Availability),
      });
    }

    if (row.Recipe_ID) {
      itemsById.get(row.Menu_Item_ID).ingredients.push({
        name: row.Inventory_Name,
        amount: Number(row.Required_Quantity),
        unit: row.Unit,
      });
    }
  }

  return Array.from(itemsById.values());
}

function inventoryFromRow(row) {
  return {
    id: row.Inventory_ID,
    name: row.Inventory_Name,
    quantity: Number(row.Quantity_On_Hand),
    unit: row.Unit,
    reorderPoint: Number(row.Reorder_Level),
    restockAmount: Number(row.Restock_Amount || row.Reorder_Level || 1),
  };
}

function categoryFromRow(row) {
  return {
    id: row.Category_ID,
    name: row.Category_Name,
    description: row.Description || '',
    supportsSize: Boolean(row.Supports_Size),
  };
}

async function saveMenuItem(connection, rawItem) {
  const ingredients = getValidIngredients(rawItem.ingredients);
  const item = {
    id: String(rawItem.id || '').trim(),
    name: String(rawItem.name || '').trim(),
    category: String(rawItem.category || '').trim(),
    description: String(rawItem.description || '').trim(),
    imageUri: String(rawItem.imageUri || '').trim(),
    price: Number.parseFloat(rawItem.price),
    availability: rawItem.availability === undefined ? 1 : Number(Boolean(rawItem.availability)),
    ingredients,
  };

  if (!item.id || !item.name || !item.category || !Number.isFinite(item.price) || item.price <= 0) {
    throw new Error('Menu item id, name, category, and price are required.');
  }

  const categoryId = await ensureCategory(connection, item.category);
  await connection.query(
    `INSERT INTO Menu_Item (Menu_Item_ID, Category_ID, Item_Name, Description, Price, Availability, Image_URI)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE Category_ID = VALUES(Category_ID), Item_Name = VALUES(Item_Name), Description = VALUES(Description), Price = VALUES(Price), Availability = VALUES(Availability), Image_URI = VALUES(Image_URI)`,
    [item.id, categoryId, item.name, item.description, item.price, item.availability, item.imageUri || null],
  );

  await connection.query('DELETE FROM Recipe_Item WHERE Menu_Item_ID = ?', [item.id]);
  for (const ingredient of ingredients) {
    const inventoryId = getInventoryKey(ingredient.name, ingredient.unit);
    await ensureInventoryForIngredient(connection, ingredient, inventoryId);
    await connection.query(
      `INSERT INTO Recipe_Item (Menu_Item_ID, Inventory_ID, Required_Quantity)
       VALUES (?, ?, ?)`,
      [item.id, inventoryId, ingredient.amount],
    );
  }

  return rawItem;
}

async function saveInventoryItem(queryable, inventoryId, rawItem = {}) {
  const id = String(inventoryId || '').trim();
  const [existingRows] = await queryable.query('SELECT * FROM Inventory WHERE Inventory_ID = ?', [id]);
  const existing = existingRows[0];
  const quantity = getNumberOrDefault(rawItem.quantity, existing ? Number(existing.Quantity_On_Hand) : 0);
  const reorderLevel = getNumberOrDefault(rawItem.reorderPoint, existing ? Number(existing.Reorder_Level) : getDefaultReorderPoint(1));
  const restockAmount = getNumberOrDefault(rawItem.restockAmount, existing ? Number(existing.Restock_Amount) : reorderLevel || 1);
  const name = String(rawItem.name || existing?.Inventory_Name || getInventoryParts(id).name).trim();
  const unit = String(rawItem.unit || existing?.Unit || getInventoryParts(id).unit).trim();

  await queryable.query(
    `INSERT INTO Inventory (Inventory_ID, Inventory_Name, Unit, Quantity_On_Hand, Reorder_Level, Restock_Amount)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE Inventory_Name = VALUES(Inventory_Name), Unit = VALUES(Unit), Quantity_On_Hand = VALUES(Quantity_On_Hand), Reorder_Level = VALUES(Reorder_Level), Restock_Amount = VALUES(Restock_Amount)`,
    [id, name, unit, quantity, reorderLevel, restockAmount],
  );
}

async function ensureCategory(connection, categoryName) {
  await connection.query(
    `INSERT INTO Category (Category_Name, Description)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE Category_ID = LAST_INSERT_ID(Category_ID)`,
    [categoryName, `${categoryName} menu items`],
  );
  const [rows] = await connection.query('SELECT LAST_INSERT_ID() AS id');
  return rows[0].id;
}

async function ensureInventoryForIngredient(connection, ingredient, inventoryId) {
  await connection.query(
    `INSERT INTO Inventory (Inventory_ID, Inventory_Name, Unit, Quantity_On_Hand, Reorder_Level, Restock_Amount)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE Inventory_Name = VALUES(Inventory_Name), Unit = VALUES(Unit)`,
    [inventoryId, ingredient.name, ingredient.unit, 0, getDefaultReorderPoint(ingredient.amount), getDefaultRestockAmount(ingredient.amount)],
  );
}

async function ensureDefaultActors(connection) {
  await connection.query(
    `INSERT IGNORE INTO Department (Department_ID, Department_Name, Description)
     VALUES (?, ?, ?)`,
    [1, 'Operations', 'Default cafe operations department'],
  );
  await connection.query(
    `INSERT IGNORE INTO Employee (Employee_ID, Department_ID, Employee_FirstName, Employee_LastName, Address)
     VALUES (?, ?, ?, ?, ?)`,
    [defaultEmployeeId, 1, 'Cafe101', 'Cashier', 'Register 01'],
  );
  await connection.query(
    `INSERT IGNORE INTO Customer_Users (Customer_ID, Customer_Name)
     VALUES (?, ?)`,
    [defaultCustomerId, 'Walk-in Customer'],
  );
}

function getValidIngredients(ingredients) {
  if (!Array.isArray(ingredients)) return [];

  return ingredients
    .map((ingredient) => ({
      name: String(ingredient.name || '').trim(),
      amount: Number.parseFloat(ingredient.amount),
      unit: String(ingredient.unit || '').trim(),
    }))
    .filter((ingredient) => (
      ingredient.name
      && Number.isFinite(ingredient.amount)
      && ingredient.amount > 0
      && ingredient.unit
    ));
}

function getValidRequirements(requirements) {
  if (!Array.isArray(requirements)) return [];

  return requirements
    .map((requirement) => ({
      id: String(requirement.id || '').trim(),
      name: String(requirement.name || requirement.id || '').trim(),
      amount: Number.parseFloat(requirement.amount),
    }))
    .filter((requirement) => requirement.id && Number.isFinite(requirement.amount) && requirement.amount > 0);
}

function getValidOrderItems(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      id: String(item.id || '').trim(),
      quantity: Number.parseFloat(item.quantity),
      price: Number.parseFloat(item.price),
      lineTotal: Number.parseFloat(item.lineTotal),
    }))
    .filter((item) => (
      item.id
      && Number.isFinite(item.quantity)
      && item.quantity > 0
      && Number.isFinite(item.price)
      && Number.isFinite(item.lineTotal)
    ));
}

function getInventoryParts(inventoryId) {
  const id = String(inventoryId || '').trim();
  const knownUnits = ['piece', 'ml', 'mg', 'kg', 'g', 'l'];
  const separatorIndex = id.lastIndexOf('-');
  if (separatorIndex < 0) return { name: id, unit: 'unit' };

  const rawUnit = id.slice(separatorIndex + 1);
  const unit = rawUnit.toLowerCase() === 'l' ? 'L' : rawUnit;
  const rawName = id.slice(0, separatorIndex);
  return {
    name: toTitleCase(rawName.replace(/-/g, ' ')),
    unit: knownUnits.includes(rawUnit.toLowerCase()) ? unit : 'unit',
  };
}

function getInventoryKey(name, unit) {
  return `${String(name).trim().toLowerCase()}-${String(unit).trim().toLowerCase()}`;
}

function getOptionType(category, supportsSize) {
  if (category === 'Coffee') return 'coffee';
  if (category === 'Sodas') return 'coldDrink';
  return supportsSize ? 'size' : 'none';
}

function getCategoryAccent(category) {
  if (category === 'Coffee') return '#B75E43';
  if (category === 'Meals') return '#76835A';
  if (category === 'Snacks') return '#D29A4A';
  if (category === 'Sodas') return '#D5B744';
  return '#B75E43';
}

function getNumberOrDefault(value, defaultValue) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function getDefaultReorderPoint(amount) {
  return roundStock(Math.max(amount * 5, 1));
}

function getDefaultRestockAmount(amount) {
  return roundStock(Math.max(amount * 20, 1));
}

function roundStock(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toTitleCase(value) {
  return String(value).replace(/\w\S*/g, (word) => (
    word.charAt(0).toUpperCase() + word.slice(1)
  ));
}