/**
 * Centralized admin authorization utility.
 * Every admin server action MUST call requireAdmin() before executing.
 */
import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export type AdminPermission = {
  read?: boolean;
  write?: boolean;
  delete?: boolean;
};

export type PermissionMatrix = {
  dashboard?: AdminPermission;
  users?: AdminPermission;
  verification?: AdminPermission;
  content?: AdminPermission;
  reports?: AdminPermission;
  aiModeration?: AdminPermission;
  messages?: AdminPermission;
  analytics?: AdminPermission;
  monetization?: AdminPermission;
  ads?: AdminPermission;
  settings?: AdminPermission;
  notifications?: AdminPermission;
  security?: AdminPermission;
  adminManagement?: AdminPermission;
  database?: AdminPermission;
  systemMonitor?: AdminPermission;
  auditLogs?: AdminPermission;
  support?: AdminPermission;
};

/** Default permission matrices per role */
const DEFAULT_PERMISSIONS: Record<string, PermissionMatrix> = {
  OWNER: {
    dashboard: { read: true, write: true, delete: true },
    users: { read: true, write: true, delete: true },
    verification: { read: true, write: true, delete: true },
    content: { read: true, write: true, delete: true },
    reports: { read: true, write: true, delete: true },
    aiModeration: { read: true, write: true, delete: true },
    messages: { read: true, write: true, delete: true },
    analytics: { read: true, write: true, delete: true },
    monetization: { read: true, write: true, delete: true },
    ads: { read: true, write: true, delete: true },
    settings: { read: true, write: true, delete: true },
    notifications: { read: true, write: true, delete: true },
    security: { read: true, write: true, delete: true },
    adminManagement: { read: true, write: true, delete: true },
    database: { read: true, write: true, delete: true },
    systemMonitor: { read: true, write: true, delete: true },
    auditLogs: { read: true, write: true, delete: true },
    support: { read: true, write: true, delete: true },
  },
  SUPER_ADMIN: {
    dashboard: { read: true, write: true, delete: true },
    users: { read: true, write: true, delete: true },
    verification: { read: true, write: true, delete: true },
    content: { read: true, write: true, delete: true },
    reports: { read: true, write: true, delete: true },
    aiModeration: { read: true, write: true, delete: true },
    messages: { read: true, write: true, delete: true },
    analytics: { read: true, write: true, delete: true },
    monetization: { read: true, write: true, delete: true },
    ads: { read: true, write: true, delete: true },
    settings: { read: true, write: true, delete: false },
    notifications: { read: true, write: true, delete: true },
    security: { read: true, write: true, delete: true },
    adminManagement: { read: true, write: true, delete: false }, // cannot delete other super admins
    database: { read: false, write: false, delete: false },
    systemMonitor: { read: true, write: false, delete: false },
    auditLogs: { read: true, write: false, delete: false },
    support: { read: true, write: true, delete: true },
  },
  MODERATOR: {
    dashboard: { read: true, write: false, delete: false },
    users: { read: true, write: false, delete: false },
    verification: { read: false, write: false, delete: false },
    content: { read: true, write: true, delete: true },
    reports: { read: true, write: true, delete: false },
    aiModeration: { read: true, write: true, delete: false },
    messages: { read: false, write: false, delete: false },
    analytics: { read: false, write: false, delete: false },
    monetization: { read: false, write: false, delete: false },
    ads: { read: false, write: false, delete: false },
    settings: { read: false, write: false, delete: false },
    notifications: { read: false, write: false, delete: false },
    security: { read: false, write: false, delete: false },
    adminManagement: { read: false, write: false, delete: false },
    database: { read: false, write: false, delete: false },
    systemMonitor: { read: false, write: false, delete: false },
    auditLogs: { read: false, write: false, delete: false },
    support: { read: false, write: false, delete: false },
  },
  SUPPORT: {
    dashboard: { read: true, write: false, delete: false },
    users: { read: true, write: false, delete: false },
    verification: { read: false, write: false, delete: false },
    content: { read: false, write: false, delete: false },
    reports: { read: false, write: false, delete: false },
    aiModeration: { read: false, write: false, delete: false },
    messages: { read: false, write: false, delete: false },
    analytics: { read: false, write: false, delete: false },
    monetization: { read: false, write: false, delete: false },
    ads: { read: false, write: false, delete: false },
    settings: { read: false, write: false, delete: false },
    notifications: { read: false, write: false, delete: false },
    security: { read: false, write: false, delete: false },
    adminManagement: { read: false, write: false, delete: false },
    database: { read: false, write: false, delete: false },
    systemMonitor: { read: false, write: false, delete: false },
    auditLogs: { read: false, write: false, delete: false },
    support: { read: true, write: true, delete: false },
  },
  ANALYST: {
    dashboard: { read: true, write: false, delete: false },
    users: { read: false, write: false, delete: false },
    verification: { read: false, write: false, delete: false },
    content: { read: false, write: false, delete: false },
    reports: { read: false, write: false, delete: false },
    aiModeration: { read: false, write: false, delete: false },
    messages: { read: false, write: false, delete: false },
    analytics: { read: true, write: false, delete: false },
    monetization: { read: true, write: false, delete: false },
    ads: { read: false, write: false, delete: false },
    settings: { read: false, write: false, delete: false },
    notifications: { read: false, write: false, delete: false },
    security: { read: false, write: false, delete: false },
    adminManagement: { read: false, write: false, delete: false },
    database: { read: false, write: false, delete: false },
    systemMonitor: { read: true, write: false, delete: false },
    auditLogs: { read: false, write: false, delete: false },
    support: { read: false, write: false, delete: false },
  },
};

export type AdminContext = {
  userId: string;
  role: string;
  permissions: PermissionMatrix;
  adminUserId: string;
};

/**
 * Validates the current session is a registered admin.
 * Throws/redirects if not authenticated or not an admin.
 * Returns a context object with the admin's role and effective permissions.
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const adminUser = await prisma.adminUser.findUnique({
    where: { userId: session.user.id },
    include: { role: true },
  });

  // Fallback: original isAdmin boolean check for backward compat during transition
  if (!adminUser) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });
    if (!user?.isAdmin) return null;
    // Treat legacy isAdmin=true as SUPER_ADMIN
    return {
      userId: session.user.id,
      role: "SUPER_ADMIN",
      permissions: DEFAULT_PERMISSIONS["SUPER_ADMIN"],
      adminUserId: session.user.id,
    };
  }

  // Parse stored permissions, fall back to defaults if not set
  let storedPermissions: PermissionMatrix = {};
  try {
    storedPermissions = JSON.parse(adminUser.role.permissions);
  } catch {
    // ignore parse errors
  }

  const defaultPerms = DEFAULT_PERMISSIONS[adminUser.role.name] || {};
  const effectivePerms: PermissionMatrix = { ...defaultPerms, ...storedPermissions };

  return {
    userId: session.user.id,
    role: adminUser.role.name,
    permissions: effectivePerms,
    adminUserId: adminUser.id,
  };
}

/**
 * Requires admin context with a specific permission.
 * Call at the start of every admin server action.
 * @param section - the panel section key (e.g. "users", "content")
 * @param level - the required level ("read" | "write" | "delete")
 */
export async function requireAdmin(
  section: keyof PermissionMatrix,
  level: "read" | "write" | "delete" = "read"
): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) {
    throw new Error("Unauthorized: Not an admin");
  }

  const sectionPerms = ctx.permissions[section];
  if (!sectionPerms || !sectionPerms[level]) {
    throw new Error(
      `Forbidden: Role '${ctx.role}' does not have '${level}' access to '${section}'`
    );
  }

  return ctx;
}

/**
 * Server-side redirect guard for admin page components.
 * Use in page.tsx Server Components when no data-fetch happens
 * before the permission check.
 */
export async function requireAdminPage(
  section: keyof PermissionMatrix
): Promise<AdminContext> {
  try {
    return await requireAdmin(section, "read");
  } catch {
    redirect("/");
  }
}

/**
 * Write an entry to the admin audit log.
 * Call after every mutating admin action.
 */
export async function writeAuditLog(
  adminId: string,
  action: string,
  opts?: {
    targetType?: string;
    targetId?: string;
    oldValue?: unknown;
    newValue?: unknown;
  }
) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId,
        action,
        targetType: opts?.targetType,
        targetId: opts?.targetId,
        oldValue: opts?.oldValue ? JSON.stringify(opts.oldValue) : undefined,
        newValue: opts?.newValue ? JSON.stringify(opts.newValue) : undefined,
      },
    });
  } catch (err) {
    // Audit log writes must never crash the main action
    console.error("Audit log write failed:", err);
  }
}
