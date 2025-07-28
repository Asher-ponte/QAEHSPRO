-- This migration removes the site_id column from the final_assessment_attempts table
-- as it was redundant. The site can be determined from the course_id.
-- This file should be run against your MySQL database.

ALTER TABLE final_assessment_attempts
DROP COLUMN site_id;
