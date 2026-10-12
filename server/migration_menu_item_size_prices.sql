USE cafe101;

ALTER TABLE Menu_Item
  ADD COLUMN Medium_Size_Increase DECIMAL(8,2) NOT NULL DEFAULT 0 AFTER Price,
  ADD COLUMN Large_Size_Increase DECIMAL(8,2) NOT NULL DEFAULT 0 AFTER Medium_Size_Increase;
