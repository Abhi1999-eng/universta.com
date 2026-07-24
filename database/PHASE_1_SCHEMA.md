# Universta Phase 1 — Database Schema Blueprint

## Conventions
- IDs: `CHAR(36)` UUID.
- Money: `DECIMAL(12,2)`.
- Percentages: `DECIMAL(5,2)`.
- General scores: `DECIMAL(6,2)`.
- Timestamps: `DATETIME(3)`.
- Booleans: `BOOLEAN`.
- Structured editor content: `JSON`.
- Status fields: `VARCHAR`, validated by application code.
- SQL table/column naming: snake_case.
- Published content uses soft deletion through `deleted_at`.
- Every FK must be indexed.
- Prisma owns application tables and migration history.

## Authentication and administration

### 1. roles
`id CHAR(36) PK`, `code VARCHAR(50) UNIQUE NOT NULL`, `name VARCHAR(100) NOT NULL`,
`description VARCHAR(500) NULL`, `is_system_role BOOLEAN DEFAULT FALSE`,
`status VARCHAR(30) DEFAULT 'ACTIVE'`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`.

### 2. users
`id CHAR(36) PK`, `email VARCHAR(255) UNIQUE NOT NULL`,
`password_hash VARCHAR(255) NOT NULL`, `first_name VARCHAR(100) NOT NULL`,
`last_name VARCHAR(100) NULL`, `phone_country_code VARCHAR(10) NULL`,
`phone_number VARCHAR(30) NULL`, `avatar_media_id CHAR(36) NULL`,
`status VARCHAR(30) DEFAULT 'ACTIVE'`, `email_verified_at DATETIME(3) NULL`,
`password_changed_at DATETIME(3) NULL`, `failed_login_attempts INT DEFAULT 0`,
`locked_until DATETIME(3) NULL`, `last_login_at DATETIME(3) NULL`,
`last_login_ip VARCHAR(45) NULL`, `timezone VARCHAR(100) DEFAULT 'Asia/Kolkata'`,
`locale VARCHAR(20) DEFAULT 'en-IN'`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`, `deleted_at DATETIME(3) NULL`.

### 3. user_roles
`id CHAR(36) PK`, `user_id CHAR(36) FK users.id`,
`role_id CHAR(36) FK roles.id`, `assigned_by_user_id CHAR(36) FK users.id NULL`,
`assigned_at DATETIME(3)`, `UNIQUE(user_id, role_id)`.

### 4. refresh_tokens
`id CHAR(36) PK`, `user_id CHAR(36) FK users.id`,
`token_hash VARCHAR(255) UNIQUE NOT NULL`, `expires_at DATETIME(3)`,
`revoked_at DATETIME(3) NULL`, `revocation_reason VARCHAR(255) NULL`,
`replaced_by_token_id CHAR(36) FK refresh_tokens.id NULL`,
`created_ip VARCHAR(45) NULL`, `user_agent VARCHAR(1000) NULL`,
`created_at DATETIME(3)`.

### 5. password_reset_tokens
`id CHAR(36) PK`, `user_id CHAR(36) FK users.id`,
`token_hash VARCHAR(255) UNIQUE NOT NULL`, `expires_at DATETIME(3)`,
`used_at DATETIME(3) NULL`, `requested_ip VARCHAR(45) NULL`,
`created_at DATETIME(3)`.

### 6. login_attempts
`id CHAR(36) PK`, `user_id CHAR(36) FK users.id NULL`,
`attempted_email VARCHAR(255) NOT NULL`, `was_successful BOOLEAN`,
`failure_reason VARCHAR(255) NULL`, `ip_address VARCHAR(45) NULL`,
`user_agent VARCHAR(1000) NULL`, `request_id VARCHAR(100) NULL`,
`created_at DATETIME(3)`.
Indexes: `(attempted_email, created_at)`, `(ip_address, created_at)`.

### 7. audit_logs
`id CHAR(36) PK`, `user_id CHAR(36) FK users.id NULL`,
`module VARCHAR(100)`, `entity_type VARCHAR(100)`, `entity_id CHAR(36) NULL`,
`action VARCHAR(50)`, `old_values JSON NULL`, `new_values JSON NULL`,
`description VARCHAR(1000) NULL`, `ip_address VARCHAR(45) NULL`,
`user_agent VARCHAR(1000) NULL`, `request_id VARCHAR(100) NULL`,
`created_at DATETIME(3)`.
Indexes: `(entity_type, entity_id)`, `(user_id, created_at)`,
`(module, action, created_at)`.

## Media and global CMS

### 8. media_assets
`id CHAR(36) PK`, `storage_provider VARCHAR(30) DEFAULT 'LOCAL'`,
`bucket_name VARCHAR(255) NULL`, `object_key VARCHAR(1000)`,
`public_url VARCHAR(2048)`, `original_file_name VARCHAR(500)`,
`stored_file_name VARCHAR(500)`, `mime_type VARCHAR(150)`,
`file_extension VARCHAR(20) NULL`, `file_size_bytes BIGINT`,
`width INT NULL`, `height INT NULL`, `duration_seconds INT NULL`,
`checksum VARCHAR(128) NULL`, `title VARCHAR(255) NULL`,
`alt_text VARCHAR(500) NULL`, `caption TEXT NULL`, `folder VARCHAR(255) NULL`,
`media_type VARCHAR(30) DEFAULT 'IMAGE'`, `status VARCHAR(30) DEFAULT 'ACTIVE'`,
`uploaded_by_user_id CHAR(36) FK users.id NULL`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`, `deleted_at DATETIME(3) NULL`.
Indexes: `(folder, status)`, `checksum`.

### 9. site_settings
`id CHAR(36) PK`, `setting_key VARCHAR(150) UNIQUE`,
`setting_group VARCHAR(100)`, `value_type VARCHAR(30)`, `value_json JSON NULL`,
`description VARCHAR(500) NULL`, `is_public BOOLEAN DEFAULT FALSE`,
`updated_by_user_id CHAR(36) FK users.id NULL`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`.
Index: `(setting_group, is_public)`.

### 10. feature_flags
`id CHAR(36) PK`, `flag_key VARCHAR(150) UNIQUE`, `name VARCHAR(255)`,
`description VARCHAR(500) NULL`, `is_enabled BOOLEAN DEFAULT FALSE`,
`environment VARCHAR(30) DEFAULT 'ALL'`, `configuration_json JSON NULL`,
`created_at DATETIME(3)`, `updated_at DATETIME(3)`.

### 11. pages
`id CHAR(36) PK`, `page_type VARCHAR(50)`, `title VARCHAR(255)`,
`short_title VARCHAR(150) NULL`, `slug VARCHAR(255) UNIQUE`,
`layout_key VARCHAR(100) NULL`, `short_description VARCHAR(1000) NULL`,
`status VARCHAR(30) DEFAULT 'DRAFT'`, `is_homepage BOOLEAN DEFAULT FALSE`,
`display_order INT DEFAULT 0`, `published_at DATETIME(3) NULL`,
`created_by_user_id CHAR(36) FK users.id NULL`,
`updated_by_user_id CHAR(36) FK users.id NULL`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`, `deleted_at DATETIME(3) NULL`.
Index: `(page_type, status, display_order)`.

### 12. page_sections
`id CHAR(36) PK`, `page_id CHAR(36) FK pages.id`,
`section_key VARCHAR(100)`, `section_type VARCHAR(100)`,
`eyebrow VARCHAR(255) NULL`, `heading VARCHAR(500) NULL`,
`subheading TEXT NULL`, `body_json JSON NULL`,
`media_id CHAR(36) FK media_assets.id NULL`,
`background_media_id CHAR(36) FK media_assets.id NULL`,
`cta_primary_label VARCHAR(100) NULL`, `cta_primary_url VARCHAR(1000) NULL`,
`cta_secondary_label VARCHAR(100) NULL`, `cta_secondary_url VARCHAR(1000) NULL`,
`configuration_json JSON NULL`, `display_order INT DEFAULT 0`,
`status VARCHAR(30) DEFAULT 'ACTIVE'`, `starts_at DATETIME(3) NULL`,
`ends_at DATETIME(3) NULL`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`, `deleted_at DATETIME(3) NULL`.
Constraints: `UNIQUE(page_id, section_key)`.
Index: `(page_id, status, display_order)`.

### 13. navigation_menus
`id CHAR(36) PK`, `name VARCHAR(150)`, `menu_key VARCHAR(100) UNIQUE`,
`location VARCHAR(50)`, `status VARCHAR(30) DEFAULT 'ACTIVE'`,
`created_at DATETIME(3)`, `updated_at DATETIME(3)`.

### 14. navigation_items
`id CHAR(36) PK`, `menu_id CHAR(36) FK navigation_menus.id`,
`parent_item_id CHAR(36) FK navigation_items.id NULL`, `label VARCHAR(150)`,
`link_type VARCHAR(30)`, `page_id CHAR(36) FK pages.id NULL`,
`custom_url VARCHAR(1000) NULL`, `icon_media_id CHAR(36) FK media_assets.id NULL`,
`open_in_new_tab BOOLEAN DEFAULT FALSE`, `css_class VARCHAR(255) NULL`,
`display_order INT DEFAULT 0`, `status VARCHAR(30) DEFAULT 'ACTIVE'`,
`created_at DATETIME(3)`, `updated_at DATETIME(3)`.
Index: `(menu_id, parent_item_id, status, display_order)`.

### 15. platform_metrics
`id CHAR(36) PK`, `metric_key VARCHAR(100) UNIQUE`, `label VARCHAR(150)`,
`numeric_value DECIMAL(20,2) NULL`, `display_value VARCHAR(100)`,
`icon_media_id CHAR(36) FK media_assets.id NULL`,
`source_reference VARCHAR(2048) NULL`, `verified_at DATETIME(3) NULL`,
`is_visible BOOLEAN DEFAULT TRUE`, `display_order INT DEFAULT 0`,
`created_at DATETIME(3)`, `updated_at DATETIME(3)`.
Index: `(is_visible, display_order)`.

### 16. seo_metadata
`id CHAR(36) PK`, `owner_type VARCHAR(50)`, `owner_id CHAR(36)`,
`seo_title VARCHAR(255)`, `meta_description VARCHAR(500)`,
`canonical_url VARCHAR(2048) NULL`, `focus_keyword VARCHAR(255) NULL`,
`og_title VARCHAR(255) NULL`, `og_description VARCHAR(500) NULL`,
`og_media_id CHAR(36) FK media_assets.id NULL`,
`twitter_title VARCHAR(255) NULL`, `twitter_description VARCHAR(500) NULL`,
`twitter_media_id CHAR(36) FK media_assets.id NULL`,
`robots_index BOOLEAN DEFAULT TRUE`, `robots_follow BOOLEAN DEFAULT TRUE`,
`schema_json JSON NULL`, `hreflang_json JSON NULL`,
`created_at DATETIME(3)`, `updated_at DATETIME(3)`.
Constraint: `UNIQUE(owner_type, owner_id)`.

### 17. redirects
`id CHAR(36) PK`, `source_path VARCHAR(1000) UNIQUE`,
`target_path VARCHAR(1000)`, `http_status_code INT DEFAULT 301`,
`is_active BOOLEAN DEFAULT TRUE`, `hit_count BIGINT DEFAULT 0`,
`last_hit_at DATETIME(3) NULL`, `created_by_user_id CHAR(36) FK users.id NULL`,
`created_at DATETIME(3)`, `updated_at DATETIME(3)`.
Index: `(is_active, http_status_code)`.


## Catalog masters and countries

### 18. continents
`id CHAR(36) PK`, `name VARCHAR(150) UNIQUE`, `slug VARCHAR(150) UNIQUE`,
`code VARCHAR(20) UNIQUE NULL`, `emoji VARCHAR(20) NULL`,
`short_description VARCHAR(1000) NULL`, `overview TEXT NULL`,
`icon_media_id CHAR(36) FK media_assets.id NULL`,
`hero_media_id CHAR(36) FK media_assets.id NULL`,
`status VARCHAR(30) DEFAULT 'ACTIVE'`, `is_featured BOOLEAN DEFAULT FALSE`,
`display_order INT DEFAULT 0`, `created_by_user_id CHAR(36) FK users.id NULL`,
`updated_by_user_id CHAR(36) FK users.id NULL`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`, `deleted_at DATETIME(3) NULL`.
Index: `(status, display_order)`.

### 19. intakes
`id CHAR(36) PK`, `name VARCHAR(100) UNIQUE`, `slug VARCHAR(100) UNIQUE`,
`month_number TINYINT NULL`, `season_name VARCHAR(50) NULL`,
`short_label VARCHAR(50) NULL`, `description VARCHAR(500) NULL`,
`status VARCHAR(30) DEFAULT 'ACTIVE'`, `display_order INT DEFAULT 0`,
`created_at DATETIME(3)`, `updated_at DATETIME(3)`.
Index: `(status, display_order)`.

### 20. subjects
`id CHAR(36) PK`, `name VARCHAR(255) UNIQUE`, `slug VARCHAR(255) UNIQUE`,
`short_description VARCHAR(1000) NULL`, `overview LONGTEXT NULL`,
`icon_media_id CHAR(36) FK media_assets.id NULL`,
`listing_media_id CHAR(36) FK media_assets.id NULL`,
`hero_media_id CHAR(36) FK media_assets.id NULL`,
`status VARCHAR(30) DEFAULT 'DRAFT'`, `is_featured BOOLEAN DEFAULT FALSE`,
`display_order INT DEFAULT 0`, `published_at DATETIME(3) NULL`,
`created_by_user_id CHAR(36) FK users.id NULL`,
`updated_by_user_id CHAR(36) FK users.id NULL`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`, `deleted_at DATETIME(3) NULL`.
Index: `(status, is_featured, display_order)`.

### 21. sub_subjects
`id CHAR(36) PK`, `subject_id CHAR(36) FK subjects.id`,
`name VARCHAR(255)`, `slug VARCHAR(255) UNIQUE`,
`short_description VARCHAR(1000) NULL`, `overview LONGTEXT NULL`,
`icon_media_id CHAR(36) FK media_assets.id NULL`,
`listing_media_id CHAR(36) FK media_assets.id NULL`,
`status VARCHAR(30) DEFAULT 'DRAFT'`, `is_featured BOOLEAN DEFAULT FALSE`,
`display_order INT DEFAULT 0`, `published_at DATETIME(3) NULL`,
`created_by_user_id CHAR(36) FK users.id NULL`,
`updated_by_user_id CHAR(36) FK users.id NULL`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`, `deleted_at DATETIME(3) NULL`.
Constraints: `UNIQUE(subject_id, name)`.
Index: `(subject_id, status, display_order)`.

### 22. course_levels
`id CHAR(36) PK`, `code VARCHAR(30) UNIQUE`, `name VARCHAR(100) UNIQUE`,
`description VARCHAR(500) NULL`, `education_order INT DEFAULT 0`,
`status VARCHAR(30) DEFAULT 'ACTIVE'`, `display_order INT DEFAULT 0`,
`created_at DATETIME(3)`, `updated_at DATETIME(3)`.

### 23. study_modes
`id CHAR(36) PK`, `code VARCHAR(30) UNIQUE`, `name VARCHAR(100) UNIQUE`,
`description VARCHAR(500) NULL`, `status VARCHAR(30) DEFAULT 'ACTIVE'`,
`display_order INT DEFAULT 0`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`.

### 24. countries
`id CHAR(36) PK`, `continent_id CHAR(36) FK continents.id`,
`name VARCHAR(150) UNIQUE`, `short_name VARCHAR(100) NULL`,
`page_heading VARCHAR(255)`, `slug VARCHAR(255) UNIQUE`,
`iso2_code CHAR(2) UNIQUE NULL`, `iso3_code CHAR(3) UNIQUE NULL`,
`dial_code VARCHAR(10) NULL`, `capital_city VARCHAR(150) NULL`,
`nationality_name VARCHAR(150) NULL`, `currency_name VARCHAR(100) NULL`,
`currency_code CHAR(3) NULL`, `currency_symbol VARCHAR(10) NULL`,
`timezone_json JSON NULL`, `flag_media_id CHAR(36) FK media_assets.id NULL`,
`listing_media_id CHAR(36) FK media_assets.id NULL`,
`hero_media_id CHAR(36) FK media_assets.id NULL`,
`map_media_id CHAR(36) FK media_assets.id NULL`,
`short_description VARCHAR(1000)`, `overview LONGTEXT NULL`,
`featured_label VARCHAR(100) NULL`, `is_featured BOOLEAN DEFAULT FALSE`,
`is_popular BOOLEAN DEFAULT FALSE`, `status VARCHAR(30) DEFAULT 'DRAFT'`,
`display_order INT DEFAULT 0`, `published_at DATETIME(3) NULL`,
`last_verified_at DATETIME(3) NULL`, `primary_source_url VARCHAR(2048) NULL`,
`created_by_user_id CHAR(36) FK users.id NULL`,
`updated_by_user_id CHAR(36) FK users.id NULL`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`, `deleted_at DATETIME(3) NULL`.
Indexes: `(continent_id, status, display_order)`,
`(status, is_featured, is_popular)`.

### 25. country_aliases
`id CHAR(36) PK`, `country_id CHAR(36) FK countries.id`,
`alias VARCHAR(255)`, `normalized_alias VARCHAR(255)`,
`alias_type VARCHAR(30) DEFAULT 'COMMON'`, `locale VARCHAR(20) DEFAULT 'en'`,
`created_at DATETIME(3)`.
Constraint: `UNIQUE(country_id, normalized_alias)`.
Index: `normalized_alias`.

### 26. country_cost_profiles
`id CHAR(36) PK`, `country_id CHAR(36) UNIQUE FK countries.id`,
`currency_code CHAR(3)`, `currency_symbol VARCHAR(10) NULL`,
`tuition_min DECIMAL(12,2) NULL`, `tuition_max DECIMAL(12,2) NULL`,
`tuition_period VARCHAR(30) DEFAULT 'PER_YEAR'`, `tuition_notes TEXT NULL`,
`living_cost_min DECIMAL(12,2) NULL`, `living_cost_max DECIMAL(12,2) NULL`,
`living_cost_period VARCHAR(30) DEFAULT 'PER_MONTH'`,
`living_cost_notes TEXT NULL`, `accommodation_min DECIMAL(12,2) NULL`,
`accommodation_max DECIMAL(12,2) NULL`, `food_cost_min DECIMAL(12,2) NULL`,
`food_cost_max DECIMAL(12,2) NULL`, `transport_cost_min DECIMAL(12,2) NULL`,
`transport_cost_max DECIMAL(12,2) NULL`,
`health_insurance_cost DECIMAL(12,2) NULL`,
`application_fee_min DECIMAL(12,2) NULL`,
`application_fee_max DECIMAL(12,2) NULL`, `budget_band VARCHAR(30) NULL`,
`applicable_year SMALLINT NULL`, `source_reference VARCHAR(2048) NULL`,
`disclaimer TEXT NULL`, `verified_at DATETIME(3) NULL`,
`created_at DATETIME(3)`, `updated_at DATETIME(3)`.
Index: `(budget_band, applicable_year)`.

### 27. country_work_profiles
`id CHAR(36) PK`, `country_id CHAR(36) UNIQUE FK countries.id`,
`part_time_allowed BOOLEAN DEFAULT FALSE`,
`part_time_hours_per_week DECIMAL(5,2) NULL`,
`part_time_hours_during_breaks DECIMAL(5,2) NULL`,
`part_time_summary TEXT NULL`, `post_study_work_available BOOLEAN DEFAULT FALSE`,
`post_study_work_min_months INT NULL`, `post_study_work_max_months INT NULL`,
`post_study_work_summary TEXT NULL`,
`immigration_pathway_strength VARCHAR(30) NULL`,
`immigration_pathway_summary TEXT NULL`,
`visa_success_band VARCHAR(30) DEFAULT 'NOT_PUBLISHED'`,
`visa_success_percentage DECIMAL(5,2) NULL`,
`visa_information LONGTEXT NULL`, `visa_processing_time VARCHAR(255) NULL`,
`proof_of_funds_summary TEXT NULL`, `source_reference VARCHAR(2048) NULL`,
`disclaimer TEXT NULL`, `verified_at DATETIME(3) NULL`,
`created_at DATETIME(3)`, `updated_at DATETIME(3)`.
Indexes: `(part_time_allowed, post_study_work_available)`,
`(immigration_pathway_strength, visa_success_band)`.

### 28. country_language_requirements
`id CHAR(36) PK`, `country_id CHAR(36) UNIQUE FK countries.id`,
`ielts_requirement VARCHAR(30) DEFAULT 'VARIES'`,
`ielts_min_score DECIMAL(3,1) NULL`, `ielts_notes VARCHAR(500) NULL`,
`pte_requirement VARCHAR(30) DEFAULT 'VARIES'`,
`pte_min_score DECIMAL(5,2) NULL`, `pte_notes VARCHAR(500) NULL`,
`toefl_requirement VARCHAR(30) DEFAULT 'VARIES'`,
`toefl_min_score DECIMAL(5,2) NULL`, `toefl_notes VARCHAR(500) NULL`,
`duolingo_requirement VARCHAR(30) DEFAULT 'VARIES'`,
`duolingo_min_score DECIMAL(5,2) NULL`, `duolingo_notes VARCHAR(500) NULL`,
`language_waiver_available BOOLEAN DEFAULT FALSE`, `waiver_notes TEXT NULL`,
`general_notes TEXT NULL`, `source_reference VARCHAR(2048) NULL`,
`disclaimer TEXT NULL`, `verified_at DATETIME(3) NULL`,
`created_at DATETIME(3)`, `updated_at DATETIME(3)`.
Index: `(ielts_requirement, language_waiver_available)`.

### 29. country_intakes
`id CHAR(36) PK`, `country_id CHAR(36) FK countries.id`,
`intake_id CHAR(36) FK intakes.id`, `is_major BOOLEAN DEFAULT FALSE`,
`availability_status VARCHAR(30) DEFAULT 'AVAILABLE'`,
`application_opening_month TINYINT NULL`,
`application_deadline_month TINYINT NULL`,
`application_opening_note VARCHAR(500) NULL`,
`application_deadline_note VARCHAR(500) NULL`, `notes TEXT NULL`,
`display_order INT DEFAULT 0`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`.
Constraint: `UNIQUE(country_id, intake_id)`.
Index: `(intake_id, is_major, availability_status)`.

### 30. country_statistics
`id CHAR(36) PK`, `country_id CHAR(36) UNIQUE FK countries.id`,
`universities_count INT DEFAULT 0`, `public_universities_count INT DEFAULT 0`,
`private_universities_count INT DEFAULT 0`, `courses_count INT DEFAULT 0`,
`ug_courses_count INT DEFAULT 0`, `pg_courses_count INT DEFAULT 0`,
`pgdm_courses_count INT DEFAULT 0`, `mba_courses_count INT DEFAULT 0`,
`phd_courses_count INT DEFAULT 0`, `scholarships_count INT DEFAULT 0`,
`cities_count INT DEFAULT 0`, `top_ranked_universities_count INT DEFAULT 0`,
`international_students_count INT NULL`,
`student_satisfaction_percentage DECIMAL(5,2) NULL`,
`source_mode VARCHAR(30) DEFAULT 'MANUAL'`,
`source_reference VARCHAR(2048) NULL`, `verified_at DATETIME(3) NULL`,
`created_at DATETIME(3)`, `updated_at DATETIME(3)`.

### 31. country_content_sections
`id CHAR(36) PK`, `country_id CHAR(36) FK countries.id`,
`section_key VARCHAR(100)`, `section_type VARCHAR(50) DEFAULT 'RICH_TEXT'`,
`eyebrow VARCHAR(255) NULL`, `heading VARCHAR(500) NULL`,
`subheading TEXT NULL`, `body_json JSON NULL`,
`primary_media_id CHAR(36) FK media_assets.id NULL`,
`secondary_media_id CHAR(36) FK media_assets.id NULL`,
`cta_label VARCHAR(100) NULL`, `cta_url VARCHAR(1000) NULL`,
`configuration_json JSON NULL`, `display_order INT DEFAULT 0`,
`status VARCHAR(30) DEFAULT 'ACTIVE'`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`, `deleted_at DATETIME(3) NULL`.
Constraint: `UNIQUE(country_id, section_key)`.
Index: `(country_id, status, display_order)`.

### 32. country_faqs
`id CHAR(36) PK`, `country_id CHAR(36) FK countries.id`,
`question VARCHAR(1000)`, `answer LONGTEXT`, `category VARCHAR(100) NULL`,
`is_featured BOOLEAN DEFAULT FALSE`, `status VARCHAR(30) DEFAULT 'ACTIVE'`,
`display_order INT DEFAULT 0`, `created_by_user_id CHAR(36) FK users.id NULL`,
`updated_by_user_id CHAR(36) FK users.id NULL`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`, `deleted_at DATETIME(3) NULL`.
Index: `(country_id, status, display_order)`.

### 33. country_tags
`id CHAR(36) PK`, `name VARCHAR(100) UNIQUE`, `slug VARCHAR(100) UNIQUE`,
`tag_type VARCHAR(50) DEFAULT 'GENERAL'`, `description VARCHAR(500) NULL`,
`status VARCHAR(30) DEFAULT 'ACTIVE'`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`.

### 34. country_tag_map
`id CHAR(36) PK`, `country_id CHAR(36) FK countries.id`,
`tag_id CHAR(36) FK country_tags.id`, `created_at DATETIME(3)`.
Constraint: `UNIQUE(country_id, tag_id)`.
Index: `(tag_id, country_id)`.


## Courses, consultants, leads, communication and analytics

### 35. courses
`id CHAR(36) PK`, `subject_id CHAR(36) FK subjects.id`,
`sub_subject_id CHAR(36) FK sub_subjects.id NULL`,
`course_level_id CHAR(36) FK course_levels.id`, `name VARCHAR(255)`,
`short_name VARCHAR(150) NULL`, `qualification_name VARCHAR(255) NULL`,
`slug VARCHAR(255) UNIQUE`, `course_code VARCHAR(100) NULL`,
`short_description VARCHAR(1000) NULL`, `overview LONGTEXT NULL`,
`duration_min DECIMAL(6,2) NULL`, `duration_max DECIMAL(6,2) NULL`,
`duration_unit VARCHAR(30) NULL`, `credits DECIMAL(8,2) NULL`,
`featured_media_id CHAR(36) FK media_assets.id NULL`,
`career_summary TEXT NULL`, `average_starting_salary DECIMAL(12,2) NULL`,
`salary_currency_code CHAR(3) NULL`, `status VARCHAR(30) DEFAULT 'DRAFT'`,
`is_featured BOOLEAN DEFAULT FALSE`, `popularity_score DECIMAL(10,2) DEFAULT 0`,
`display_order INT DEFAULT 0`, `published_at DATETIME(3) NULL`,
`created_by_user_id CHAR(36) FK users.id NULL`,
`updated_by_user_id CHAR(36) FK users.id NULL`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`, `deleted_at DATETIME(3) NULL`.
Indexes: `(subject_id, sub_subject_id, course_level_id, status)`,
`(status, is_featured, popularity_score)`.

### 36. course_study_modes
`id CHAR(36) PK`, `course_id CHAR(36) FK courses.id`,
`study_mode_id CHAR(36) FK study_modes.id`, `created_at DATETIME(3)`.
Constraint: `UNIQUE(course_id, study_mode_id)`.

### 37. country_courses
`id CHAR(36) PK`, `country_id CHAR(36) FK countries.id`,
`course_id CHAR(36) FK courses.id`,
`availability_status VARCHAR(30) DEFAULT 'AVAILABLE'`,
`indicative_tuition_min DECIMAL(12,2) NULL`,
`indicative_tuition_max DECIMAL(12,2) NULL`, `currency_code CHAR(3) NULL`,
`tuition_period VARCHAR(30) DEFAULT 'PER_YEAR'`,
`application_fee_min DECIMAL(12,2) NULL`,
`application_fee_max DECIMAL(12,2) NULL`,
`duration_min_override DECIMAL(6,2) NULL`,
`duration_max_override DECIMAL(6,2) NULL`,
`duration_unit_override VARCHAR(30) NULL`,
`academic_min_percentage DECIMAL(5,2) NULL`,
`academic_min_cgpa DECIMAL(4,2) NULL`, `ielts_min_score DECIMAL(3,1) NULL`,
`pte_min_score DECIMAL(5,2) NULL`, `toefl_min_score DECIMAL(5,2) NULL`,
`duolingo_min_score DECIMAL(5,2) NULL`, `work_experience_months INT NULL`,
`scholarship_available BOOLEAN DEFAULT FALSE`,
`admission_requirements LONGTEXT NULL`, `english_requirements LONGTEXT NULL`,
`application_notes TEXT NULL`, `career_opportunities TEXT NULL`,
`source_reference VARCHAR(2048) NULL`, `verified_at DATETIME(3) NULL`,
`status VARCHAR(30) DEFAULT 'ACTIVE'`, `is_featured BOOLEAN DEFAULT FALSE`,
`display_order INT DEFAULT 0`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`, `deleted_at DATETIME(3) NULL`.
Constraint: `UNIQUE(country_id, course_id)`.
Indexes: `(country_id, status, is_featured)`, `(course_id, status)`.

### 38. country_course_intakes
`id CHAR(36) PK`, `country_course_id CHAR(36) FK country_courses.id`,
`intake_id CHAR(36) FK intakes.id`, `application_deadline DATE NULL`,
`deadline_notes VARCHAR(500) NULL`, `status VARCHAR(30) DEFAULT 'ACTIVE'`,
`created_at DATETIME(3)`, `updated_at DATETIME(3)`.
Constraint: `UNIQUE(country_course_id, intake_id)`.
Index: `(intake_id, status)`.

### 39. course_content_sections
`id CHAR(36) PK`, `course_id CHAR(36) FK courses.id`,
`section_key VARCHAR(100)`, `heading VARCHAR(500) NULL`,
`subheading TEXT NULL`, `body_json JSON NULL`,
`media_id CHAR(36) FK media_assets.id NULL`, `display_order INT DEFAULT 0`,
`status VARCHAR(30) DEFAULT 'ACTIVE'`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`, `deleted_at DATETIME(3) NULL`.
Constraint: `UNIQUE(course_id, section_key)`.
Index: `(course_id, status, display_order)`.

### 40. course_faqs
`id CHAR(36) PK`, `course_id CHAR(36) FK courses.id`,
`question VARCHAR(1000)`, `answer LONGTEXT`,
`status VARCHAR(30) DEFAULT 'ACTIVE'`, `display_order INT DEFAULT 0`,
`created_at DATETIME(3)`, `updated_at DATETIME(3)`,
`deleted_at DATETIME(3) NULL`.
Index: `(course_id, status, display_order)`.

### 41. related_courses
`id CHAR(36) PK`, `course_id CHAR(36) FK courses.id`,
`related_course_id CHAR(36) FK courses.id`,
`relationship_type VARCHAR(30) DEFAULT 'RELATED'`,
`display_order INT DEFAULT 0`, `created_at DATETIME(3)`.
Constraint: `UNIQUE(course_id, related_course_id, relationship_type)`.
Add SQL check where supported: `course_id <> related_course_id`.

### 42. consultant_landing_cards
`id CHAR(36) PK`, `country_id CHAR(36) FK countries.id NULL`,
`title VARCHAR(255)`, `slug VARCHAR(255) UNIQUE`,
`short_description VARCHAR(1000)`, `overview LONGTEXT NULL`,
`icon_media_id CHAR(36) FK media_assets.id NULL`,
`featured_media_id CHAR(36) FK media_assets.id NULL`,
`is_free_consultation BOOLEAN DEFAULT TRUE`,
`cta_label VARCHAR(100) DEFAULT 'View consultants'`,
`cta_url VARCHAR(1000) NULL`, `status VARCHAR(30) DEFAULT 'DRAFT'`,
`is_featured BOOLEAN DEFAULT FALSE`, `display_order INT DEFAULT 0`,
`published_at DATETIME(3) NULL`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`, `deleted_at DATETIME(3) NULL`.
Index: `(country_id, status, display_order)`.

### 43. leads
`id CHAR(36) PK`, `lead_number VARCHAR(50) UNIQUE`,
`form_type VARCHAR(50)`, `source_type VARCHAR(50) NULL`,
`source_entity_id CHAR(36) NULL`, `source_page_url VARCHAR(2048) NULL`,
`first_name VARCHAR(100)`, `last_name VARCHAR(100) NULL`,
`email VARCHAR(255) NULL`, `phone_country_code VARCHAR(10) NULL`,
`phone_number VARCHAR(30)`, `current_city VARCHAR(150) NULL`,
`current_state VARCHAR(150) NULL`, `current_country VARCHAR(150) NULL`,
`preferred_country_id CHAR(36) FK countries.id NULL`,
`preferred_course_id CHAR(36) FK courses.id NULL`,
`preferred_subject_id CHAR(36) FK subjects.id NULL`,
`preferred_course_level_id CHAR(36) FK course_levels.id NULL`,
`preferred_intake_id CHAR(36) FK intakes.id NULL`,
`budget_min DECIMAL(12,2) NULL`, `budget_max DECIMAL(12,2) NULL`,
`budget_currency_code CHAR(3) NULL`, `english_test_type VARCHAR(30) NULL`,
`english_test_score DECIMAL(6,2) NULL`,
`highest_qualification VARCHAR(255) NULL`, `message TEXT NULL`,
`status VARCHAR(30) DEFAULT 'NEW'`, `priority VARCHAR(30) DEFAULT 'NORMAL'`,
`assigned_to_user_id CHAR(36) FK users.id NULL`,
`next_follow_up_at DATETIME(3) NULL`, `marketing_consent BOOLEAN DEFAULT FALSE`,
`privacy_consent BOOLEAN DEFAULT FALSE`, `utm_source VARCHAR(255) NULL`,
`utm_medium VARCHAR(255) NULL`, `utm_campaign VARCHAR(255) NULL`,
`utm_term VARCHAR(255) NULL`, `utm_content VARCHAR(255) NULL`,
`referrer_url VARCHAR(2048) NULL`, `landing_page_url VARCHAR(2048) NULL`,
`ip_address VARCHAR(45) NULL`, `user_agent VARCHAR(1000) NULL`,
`created_at DATETIME(3)`, `updated_at DATETIME(3)`,
`deleted_at DATETIME(3) NULL`.
Indexes: `(status, created_at)`, `phone_number`, `email`,
`(assigned_to_user_id, status)`, `(preferred_country_id, preferred_course_id)`.

### 44. counselling_bookings
`id CHAR(36) PK`, `lead_id CHAR(36) FK leads.id`, `booking_date DATE`,
`slot_start_at DATETIME(3)`, `slot_end_at DATETIME(3) NULL`,
`timezone VARCHAR(100) DEFAULT 'Asia/Kolkata'`,
`booking_mode VARCHAR(30) DEFAULT 'PHONE'`,
`booking_status VARCHAR(30) DEFAULT 'PENDING'`,
`assigned_to_user_id CHAR(36) FK users.id NULL`,
`meeting_url VARCHAR(2048) NULL`, `meeting_provider VARCHAR(50) NULL`,
`meeting_id VARCHAR(255) NULL`, `customer_notes TEXT NULL`,
`internal_notes TEXT NULL`, `confirmed_at DATETIME(3) NULL`,
`completed_at DATETIME(3) NULL`, `cancelled_at DATETIME(3) NULL`,
`cancellation_reason VARCHAR(500) NULL`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`.
Indexes: `(booking_date, booking_status)`,
`(assigned_to_user_id, slot_start_at)`.

### 45. lead_notes
`id CHAR(36) PK`, `lead_id CHAR(36) FK leads.id`,
`user_id CHAR(36) FK users.id`, `note_type VARCHAR(30) DEFAULT 'GENERAL'`,
`note LONGTEXT`, `is_pinned BOOLEAN DEFAULT FALSE`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`, `deleted_at DATETIME(3) NULL`.
Index: `(lead_id, is_pinned, created_at)`.

### 46. lead_status_history
`id CHAR(36) PK`, `lead_id CHAR(36) FK leads.id`,
`old_status VARCHAR(30) NULL`, `new_status VARCHAR(30)`,
`changed_by_user_id CHAR(36) FK users.id NULL`,
`reason VARCHAR(500) NULL`, `created_at DATETIME(3)`.
Index: `(lead_id, created_at)`.

### 47. email_templates
`id CHAR(36) PK`, `template_key VARCHAR(150) UNIQUE`,
`name VARCHAR(255)`, `subject_template VARCHAR(500)`,
`body_html LONGTEXT`, `body_text LONGTEXT NULL`, `variables_json JSON NULL`,
`sender_name VARCHAR(255) NULL`, `reply_to_email VARCHAR(255) NULL`,
`status VARCHAR(30) DEFAULT 'ACTIVE'`,
`created_by_user_id CHAR(36) FK users.id NULL`,
`updated_by_user_id CHAR(36) FK users.id NULL`, `created_at DATETIME(3)`,
`updated_at DATETIME(3)`.

### 48. email_logs
`id CHAR(36) PK`, `template_id CHAR(36) FK email_templates.id NULL`,
`related_entity_type VARCHAR(50) NULL`, `related_entity_id CHAR(36) NULL`,
`recipient_email VARCHAR(255)`, `recipient_name VARCHAR(255) NULL`,
`subject VARCHAR(500)`, `provider VARCHAR(50) NULL`,
`provider_message_id VARCHAR(255) NULL`, `status VARCHAR(30) DEFAULT 'QUEUED'`,
`error_message TEXT NULL`, `queued_at DATETIME(3) NULL`,
`sent_at DATETIME(3) NULL`, `delivered_at DATETIME(3) NULL`,
`failed_at DATETIME(3) NULL`, `created_at DATETIME(3)`.
Indexes: `(status, created_at)`, `(related_entity_type, related_entity_id)`.

### 49. search_logs
`id CHAR(36) PK`, `search_type VARCHAR(30)`,
`query_text VARCHAR(500) NULL`, `normalized_query VARCHAR(500) NULL`,
`filters_json JSON NULL`, `sorting VARCHAR(100) NULL`,
`result_count INT DEFAULT 0`, `selected_entity_type VARCHAR(50) NULL`,
`selected_entity_id CHAR(36) NULL`, `session_id VARCHAR(255) NULL`,
`ip_hash VARCHAR(255) NULL`, `user_agent VARCHAR(1000) NULL`,
`source_page_url VARCHAR(2048) NULL`, `created_at DATETIME(3)`.
Indexes: `(search_type, created_at)`, `normalized_query`.

### 50. _prisma_migrations
Created and owned by Prisma Migrate. Do not define or edit it manually.

## Custom full-text indexes
Add via reviewed migration SQL if supported by the installed MySQL version:
- `FULLTEXT countries(name, page_heading, short_description)`
- `FULLTEXT courses(name, short_description, overview)`

## Seed values

Continents/regions:
- Europe
- North America
- Asia
- Australia & New Zealand
- Middle East
- Africa
- South America

Course levels:
- DIPLOMA
- UG
- PGDM
- PG
- MBA
- PHD
- CERTIFICATE

Study modes:
- FULL_TIME
- PART_TIME
- ONLINE
- HYBRID

Feature flags:
- PUBLIC_LOGIN=false
- COMPARE_COUNTRIES=false
- MATCHING_TOOL=false
- CONSULTANT_DIRECTORY=true
- STUDENT_ACCOUNT=false

## Deletion rules
- Published countries, subjects and courses: soft delete/archive first.
- Restrict permanent country deletion while active mappings exist.
- Restrict subject deletion while courses exist.
- Restrict media deletion while referenced.
- Preserve audit/history records.
- Use explicit cascade only for true owned child records.
