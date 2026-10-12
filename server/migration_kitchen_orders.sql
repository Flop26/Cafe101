USE cafe101;

-- Run once on existing databases before deploying the updated API.
ALTER TABLE Orders
  ADD COLUMN Kitchen_Status VARCHAR(20) NOT NULL DEFAULT 'Working' AFTER Status,
  ADD COLUMN Order_Details JSON NULL AFTER Kitchen_Status;
