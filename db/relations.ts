import { relations } from "drizzle-orm/relations";
import { user, account, session, businessContext, systems } from "./schema";

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	accounts: many(account),
	sessions: many(session),
	businessContexts: many(businessContext),
	systems: many(systems),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const businessContextRelations = relations(businessContext, ({one}) => ({
	user: one(user, {
		fields: [businessContext.userId],
		references: [user.id]
	}),
}));

export const systemsRelations = relations(systems, ({one}) => ({
	user: one(user, {
		fields: [systems.userId],
		references: [user.id]
	}),
}));