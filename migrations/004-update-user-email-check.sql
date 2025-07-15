ALTER TABLE "Users"
DROP CONSTRAINT IF EXISTS "Users_email_check";

     ALTER TABLE "Users"
     ADD CONSTRAINT "Users_email_check"
     CHECK ( email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' );