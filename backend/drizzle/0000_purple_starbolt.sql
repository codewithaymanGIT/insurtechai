CREATE TABLE `applicants` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`age` integer NOT NULL,
	`gender` text NOT NULL,
	`occupation` text NOT NULL,
	`location` text NOT NULL,
	`annual_income` real NOT NULL,
	`marital_status` text NOT NULL,
	`dependents` integer NOT NULL,
	`health_profile` text,
	`motor_profile` text,
	`property_profile` text,
	`life_profile` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `claims` (
	`id` text PRIMARY KEY NOT NULL,
	`policy_id` text NOT NULL,
	`claim_amount` real NOT NULL,
	`claim_date` text NOT NULL,
	`claim_type` text NOT NULL,
	`status` text DEFAULT 'SETTLED' NOT NULL,
	`description` text,
	FOREIGN KEY (`policy_id`) REFERENCES `policies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fraud_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`policy_id` text NOT NULL,
	`risk_assessment_id` text,
	`fraud_score` real NOT NULL,
	`anomaly_level` text NOT NULL,
	`signals_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`policy_id`) REFERENCES `policies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`risk_assessment_id`) REFERENCES `risk_assessments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fraud_assessments_risk_assessment_id_unique` ON `fraud_assessments` (`risk_assessment_id`);--> statement-breakpoint
CREATE TABLE `policies` (
	`id` text PRIMARY KEY NOT NULL,
	`applicant_id` text NOT NULL,
	`insurance_type` text NOT NULL,
	`coverage_level` text NOT NULL,
	`deductible` real NOT NULL,
	`policy_number` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`applicant_id`) REFERENCES `applicants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `policies_policy_number_unique` ON `policies` (`policy_number`);--> statement-breakpoint
CREATE TABLE `premium_calculations` (
	`id` text PRIMARY KEY NOT NULL,
	`policy_id` text NOT NULL,
	`risk_assessment_id` text NOT NULL,
	`base_premium` real NOT NULL,
	`risk_multiplier` real NOT NULL,
	`coverage_multiplier` real NOT NULL,
	`location_factor` real NOT NULL,
	`claim_history_factor` real NOT NULL,
	`fraud_adjustment` real NOT NULL,
	`deductible_factor` real NOT NULL,
	`final_premium` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`policy_id`) REFERENCES `policies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`risk_assessment_id`) REFERENCES `risk_assessments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `premium_calculations_risk_assessment_id_unique` ON `premium_calculations` (`risk_assessment_id`);--> statement-breakpoint
CREATE TABLE `recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`risk_assessment_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`estimated_saving_amount` real NOT NULL,
	`estimated_saving_percent` real NOT NULL,
	`effort` text NOT NULL,
	`impact_per_effort` real NOT NULL,
	FOREIGN KEY (`risk_assessment_id`) REFERENCES `risk_assessments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `risk_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`policy_id` text NOT NULL,
	`risk_score` real NOT NULL,
	`raw_score` real NOT NULL,
	`risk_category` text NOT NULL,
	`category_breakdown_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`policy_id`) REFERENCES `policies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `risk_factors` (
	`id` text PRIMARY KEY NOT NULL,
	`risk_assessment_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`impact` real NOT NULL,
	`direction` text NOT NULL,
	`description` text NOT NULL,
	FOREIGN KEY (`risk_assessment_id`) REFERENCES `risk_assessments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`applicant_id` text NOT NULL,
	`label` text NOT NULL,
	`baseline_json` text NOT NULL,
	`scenario_json` text NOT NULL,
	`risk_score_delta` real NOT NULL,
	`premium_delta` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`applicant_id`) REFERENCES `applicants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);