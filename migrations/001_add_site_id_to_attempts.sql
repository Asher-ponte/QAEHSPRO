-- Add the site_id column to the final_assessment_attempts table
-- This helps with data segregation and querying in the multi-tenant setup.

ALTER TABLE `final_assessment_attempts`
ADD COLUMN `site_id` VARCHAR(255) NULL AFTER `course_id`,
ADD INDEX `idx_site_id` (`site_id`);

-- You can run the following command to verify the column was added:
-- DESCRIBE final_assessment_attempts;
