USE cafe101;

ALTER TABLE Category
  ADD COLUMN Supports_Size TINYINT(1) NOT NULL DEFAULT 0;

UPDATE Category
SET Supports_Size = 1
WHERE Category_Name IN ('Coffee', 'Sodas');