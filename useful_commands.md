# Run app
pnpm run dev

# Update database as per schema changes
pnpm db:generate
pnpm db:migrate

# Forward stripe command to local instance
stripe listen --forward-to localhost:3000/api/stripe/webhook