USE cafe101;

ALTER TABLE Inventory
  ADD COLUMN Inventory_Name VARCHAR(150) NULL AFTER Inventory_ID,
  ADD COLUMN Unit VARCHAR(20) NULL AFTER Inventory_Name,
  ADD COLUMN Restock_Amount DECIMAL(12,2) NULL AFTER Reorder_Level;

UPDATE Inventory
SET
  Inventory_Name = COALESCE(JSON_UNQUOTE(JSON_EXTRACT(History, '$.name')), Inventory_ID),
  Unit = COALESCE(JSON_UNQUOTE(JSON_EXTRACT(History, '$.unit')), 'unit'),
  Restock_Amount = COALESCE(JSON_EXTRACT(History, '$.restockAmount'), Reorder_Level, 1);

ALTER TABLE Inventory
  MODIFY Inventory_Name VARCHAR(150) NOT NULL,
  MODIFY Unit VARCHAR(20) NOT NULL,
  MODIFY Restock_Amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  DROP COLUMN History;