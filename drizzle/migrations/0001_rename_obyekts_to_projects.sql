-- Migration: Rename obyekts table and related columns to projects
-- This migration renames the table and all foreign key columns from obyekt to project

-- Step 1: Rename the main table
RENAME TABLE `obyekts` TO `projects`;

-- Step 2: Rename the foreign key columns in related tables
-- Note: This requires dropping and re-adding foreign key constraints

-- smetas table
ALTER TABLE `smetas` DROP FOREIGN KEY IF EXISTS `smetas_obyekt_id_fk`;
ALTER TABLE `smetas` CHANGE COLUMN `obyekt_id` `project_id` VARCHAR(36) NOT NULL;
ALTER TABLE `smetas` ADD CONSTRAINT `smetas_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE;

-- telegram_groups table
ALTER TABLE `telegram_groups` DROP FOREIGN KEY IF EXISTS `telegram_groups_obyekt_id_fk`;
ALTER TABLE `telegram_groups` CHANGE COLUMN `obyekt_id` `project_id` VARCHAR(36) NOT NULL;
ALTER TABLE `telegram_groups` ADD CONSTRAINT `telegram_groups_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE;

-- warehouses table
ALTER TABLE `warehouses` DROP FOREIGN KEY IF EXISTS `warehouses_obyekt_id_fk`;
ALTER TABLE `warehouses` CHANGE COLUMN `obyekt_id` `project_id` VARCHAR(36) NOT NULL;
ALTER TABLE `warehouses` ADD CONSTRAINT `warehouses_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE;

-- work_logs table
ALTER TABLE `work_logs` DROP FOREIGN KEY IF EXISTS `work_logs_obyekt_id_fk`;
ALTER TABLE `work_logs` CHANGE COLUMN `obyekt_id` `project_id` VARCHAR(36) NOT NULL;
ALTER TABLE `work_logs` ADD CONSTRAINT `work_logs_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE;

-- expenses table
ALTER TABLE `expenses` DROP FOREIGN KEY IF EXISTS `expenses_obyekt_id_fk`;
ALTER TABLE `expenses` CHANGE COLUMN `obyekt_id` `project_id` VARCHAR(36) NOT NULL;
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE;

-- incomes table
ALTER TABLE `incomes` DROP FOREIGN KEY IF EXISTS `incomes_obyekt_id_fk`;
ALTER TABLE `incomes` CHANGE COLUMN `obyekt_id` `project_id` VARCHAR(36) NOT NULL;
ALTER TABLE `incomes` ADD CONSTRAINT `incomes_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE;

-- supply_orders table (if exists)
ALTER TABLE `supply_orders` DROP FOREIGN KEY IF EXISTS `supply_orders_obyekt_id_fk`;
ALTER TABLE `supply_orders` CHANGE COLUMN `obyekt_id` `project_id` VARCHAR(36) NOT NULL;
ALTER TABLE `supply_orders` ADD CONSTRAINT `supply_orders_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE;
