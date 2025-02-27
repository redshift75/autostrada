CREATE TYPE "public"."vehicle_condition" AS ENUM('concours', 'excellent', 'good', 'fair', 'poor', 'project');--> statement-breakpoint
CREATE TYPE "public"."vehicle_source" AS ENUM('bring_a_trailer', 'rm_sothebys', 'gooding', 'bonhams', 'dupont_registry', 'autotrader', 'other');--> statement-breakpoint
CREATE TYPE "public"."drivetrain_type" AS ENUM('rwd', 'fwd', 'awd', '4wd', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."fuel_type" AS ENUM('gasoline', 'diesel', 'electric', 'hybrid', 'other', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."transmission_type" AS ENUM('manual', 'automatic', 'semi_automatic', 'cvt', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'editor', 'user');--> statement-breakpoint
CREATE TABLE "images" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehicle_id" integer,
	"url" varchar(500) NOT NULL,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehicle_id" integer,
	"source" "vehicle_source" NOT NULL,
	"source_url" varchar(500) NOT NULL,
	"title" varchar(255) NOT NULL,
	"price" integer,
	"currency" varchar(10) DEFAULT 'USD',
	"listing_date" timestamp,
	"end_date" timestamp,
	"is_sold" boolean DEFAULT false,
	"sold_price" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehicle_id" integer,
	"price" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'USD',
	"date" timestamp DEFAULT now() NOT NULL,
	"source" "vehicle_source",
	"source_url" varchar(500),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"make" varchar(100) NOT NULL,
	"model" varchar(100) NOT NULL,
	"year" integer NOT NULL,
	"vin" varchar(50),
	"description" text,
	"condition" "vehicle_condition",
	"mileage" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "features" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" varchar(50),
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "features_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "manufacturers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"country" varchar(100),
	"founded_year" integer,
	"description" text,
	"logo_url" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "manufacturers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" serial PRIMARY KEY NOT NULL,
	"manufacturer_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"start_year" integer,
	"end_year" integer,
	"category" varchar(50),
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "models_manufacturer_id_name_unique" UNIQUE("manufacturer_id","name")
);
--> statement-breakpoint
CREATE TABLE "vehicle_features" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehicle_id" integer NOT NULL,
	"feature_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_features_vehicle_id_feature_id_unique" UNIQUE("vehicle_id","feature_id")
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" serial NOT NULL,
	"name" varchar(100) NOT NULL,
	"criteria" text NOT NULL,
	"is_notification_enabled" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"vehicle_id" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"password_hash" varchar(255),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login" timestamp,
	"profile_image_url" varchar(500),
	"bio" text,
	"preferences" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models" ADD CONSTRAINT "models_manufacturer_id_manufacturers_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."manufacturers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_features" ADD CONSTRAINT "vehicle_features_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_features" ADD CONSTRAINT "vehicle_features_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_vehicles" ADD CONSTRAINT "saved_vehicles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_vehicles" ADD CONSTRAINT "saved_vehicles_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;