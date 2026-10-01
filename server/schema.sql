
CREATE DATABASE IF NOT EXISTS cafe101;
USE cafe101;

CREATE TABLE IF NOT EXISTS Department (
  Department_ID INT AUTO_INCREMENT PRIMARY KEY,
  Department_Name VARCHAR(120) NOT NULL UNIQUE,
  Description TEXT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Employee (
  Employee_ID INT AUTO_INCREMENT PRIMARY KEY,
  Department_ID INT NOT NULL,
  Employee_FirstName VARCHAR(80) NOT NULL,
  Employee_LastName VARCHAR(80) NOT NULL,
  Address VARCHAR(255),
  CONSTRAINT fk_employee_department
    FOREIGN KEY (Department_ID) REFERENCES Department(Department_ID)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Customer_Users (
  Customer_ID INT AUTO_INCREMENT PRIMARY KEY,
  Customer_Name VARCHAR(150) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Category (
  Category_ID INT AUTO_INCREMENT PRIMARY KEY,
  Category_Name VARCHAR(80) NOT NULL UNIQUE,
  Description TEXT,
  Supports_Size TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Menu_Item (
  Menu_Item_ID VARCHAR(100) PRIMARY KEY,
  Category_ID INT NOT NULL,
  Item_Name VARCHAR(150) NOT NULL,
  Description TEXT,
  Price DECIMAL(10,2) NOT NULL,
  Availability TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_menu_item_category
    FOREIGN KEY (Category_ID) REFERENCES Category(Category_ID)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Inventory: PK + Quantity_On_Hand + Reorder_Level + History match the ERD.
-- Inventory_Name, Unit, and Restock_Amount are additions the app relies on.
CREATE TABLE IF NOT EXISTS Inventory (
  Inventory_ID VARCHAR(150) PRIMARY KEY,
  Inventory_Name VARCHAR(150) NOT NULL,
  Unit VARCHAR(20) NOT NULL,
  Quantity_On_Hand DECIMAL(12,2) NOT NULL DEFAULT 0,
  Reorder_Level DECIMAL(12,2) NOT NULL DEFAULT 0,
  Restock_Amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  History JSON NOT NULL DEFAULT (JSON_ARRAY())
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Recipe_Item (
  Recipe_ID BIGINT AUTO_INCREMENT PRIMARY KEY,
  Menu_Item_ID VARCHAR(100) NOT NULL,
  Inventory_ID VARCHAR(150) NOT NULL,
  Required_Quantity DECIMAL(12,2) NOT NULL,
  UNIQUE KEY uq_recipe_item_menu_inventory (Menu_Item_ID, Inventory_ID),
  CONSTRAINT fk_recipe_item_menu_item
    FOREIGN KEY (Menu_Item_ID) REFERENCES Menu_Item(Menu_Item_ID)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_recipe_item_inventory
    FOREIGN KEY (Inventory_ID) REFERENCES Inventory(Inventory_ID)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Orders (
  Order_ID VARCHAR(100) PRIMARY KEY,
  Customer_ID INT NOT NULL,
  Employee_ID INT NOT NULL,
  Order_Date DATETIME NOT NULL,
  Total_Amount DECIMAL(10,2) NOT NULL,
  Status VARCHAR(30) NOT NULL,
  CONSTRAINT fk_orders_customer_users
    FOREIGN KEY (Customer_ID) REFERENCES Customer_Users(Customer_ID)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_orders_employee
    FOREIGN KEY (Employee_ID) REFERENCES Employee(Employee_ID)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Orders_Item (
  Order_Item_ID BIGINT AUTO_INCREMENT PRIMARY KEY,
  Order_ID VARCHAR(100) NOT NULL,
  Menu_Item_ID VARCHAR(100) NOT NULL,
  Quantity DECIMAL(10,2) NOT NULL,
  Unit_Price DECIMAL(10,2) NOT NULL,
  Subtotal DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_orders_item_orders
    FOREIGN KEY (Order_ID) REFERENCES Orders(Order_ID)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_orders_item_menu_item
    FOREIGN KEY (Menu_Item_ID) REFERENCES Menu_Item(Menu_Item_ID)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Payment_Item (
  Payment_ID VARCHAR(100) PRIMARY KEY,
  Order_ID VARCHAR(100) NOT NULL,
  Payment_Date DATETIME NOT NULL,
  Amount DECIMAL(10,2) NOT NULL,
  Payment_Method VARCHAR(30) NOT NULL,
  Status VARCHAR(30) NOT NULL,
  Transaction_Reference VARCHAR(120),
  CONSTRAINT fk_payment_item_orders
    FOREIGN KEY (Order_ID) REFERENCES Orders(Order_ID)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Spillage_Log (
  Spillage_ID BIGINT AUTO_INCREMENT PRIMARY KEY,
  Inventory_ID VARCHAR(150) NOT NULL,
  Employee_ID INT NOT NULL,
  Quantity_Wasted DECIMAL(12,2) NOT NULL,
  Reason TEXT,
  Logged_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_spillage_log_inventory
    FOREIGN KEY (Inventory_ID) REFERENCES Inventory(Inventory_ID)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_spillage_log_employee
    FOREIGN KEY (Employee_ID) REFERENCES Employee(Employee_ID)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

INSERT IGNORE INTO Department (Department_ID, Department_Name, Description)
VALUES (1, 'Operations', 'Default cafe operations department');

INSERT IGNORE INTO Employee (Employee_ID, Department_ID, Employee_FirstName, Employee_LastName, Address)
VALUES (1, 1, 'Cafe101', 'Cashier', 'Register 01');

INSERT IGNORE INTO Customer_Users (Customer_ID, Customer_Name)
VALUES (1, 'Walk-in Customer');

INSERT IGNORE INTO Category (Category_ID, Category_Name, Description)
VALUES
(1, 'Coffee', 'Espresso-based drinks'),
(2, 'Meals', 'Prepared meal items'),
(3, 'Snacks', 'Bakery and snack items'),
(4, 'Sodas', 'Cold drinks and sodas');

INSERT IGNORE INTO Inventory (Inventory_ID, Inventory_Name, Unit, Quantity_On_Hand, Reorder_Level, Restock_Amount)
VALUES
('espresso-g', 'Espresso', 'g', 6000, 1000, 1000),
('hot water-ml', 'Hot water', 'ml', 50000, 5000, 10000),
('steamed milk-ml', 'Steamed milk', 'ml', 20000, 4000, 5000),
('chocolate sauce-ml', 'Chocolate sauce', 'ml', 4000, 700, 1000),
('milk-ml', 'Milk', 'ml', 18000, 3500, 5000),
('flour-g', 'Flour', 'g', 10000, 2000, 2500),
('butter-g', 'Butter', 'g', 5000, 1000, 1000),
('egg-piece', 'Egg', 'piece', 36, 8, 12),
('sourdough-piece', 'Sourdough', 'piece', 24, 6, 6),
('avocado-g', 'Avocado', 'g', 5000, 1000, 1000),
('herbs-g', 'Herbs', 'g', 250, 50, 100),
('lemon juice-ml', 'Lemon juice', 'ml', 6000, 1000, 1500),
('mint-g', 'Mint', 'g', 300, 60, 100),
('water-ml', 'Water', 'ml', 60000, 5000, 10000),
('syrup-ml', 'Syrup', 'ml', 5000, 800, 1000);

INSERT IGNORE INTO Menu_Item (Menu_Item_ID, Category_ID, Item_Name, Description, Price, Availability)
VALUES
('americano', 1, 'Cafe Americano', 'Bold espresso, hot water', 3.50, 1),
('latte', 1, 'Caffe Latte', 'Espresso, steamed milk', 4.50, 1),
('mocha', 1, 'Mocha', 'Chocolate, espresso, milk', 5.00, 1),
('croissant', 3, 'Butter Croissant', 'Freshly baked every morning', 3.25, 1),
('toast', 2, 'Avocado Toast', 'Sourdough, avocado, herbs', 7.50, 1),
('lemonade', 4, 'House Lemonade', 'Fresh lemon, mint, ice', 3.75, 1);

INSERT IGNORE INTO Recipe_Item (Menu_Item_ID, Inventory_ID, Required_Quantity)
VALUES
('americano', 'espresso-g', 18),
('americano', 'hot water-ml', 180),
('latte', 'espresso-g', 18),
('latte', 'steamed milk-ml', 200),
('mocha', 'espresso-g', 18),
('mocha', 'chocolate sauce-ml', 30),
('mocha', 'milk-ml', 220),
('croissant', 'flour-g', 60),
('croissant', 'butter-g', 15),
('croissant', 'egg-piece', 1),
('toast', 'sourdough-piece', 1),
('toast', 'avocado-g', 80),
('toast', 'herbs-g', 2),
('lemonade', 'lemon juice-ml', 40),
('lemonade', 'mint-g', 2),
('lemonade', 'water-ml', 280),
('lemonade', 'syrup-ml', 30);