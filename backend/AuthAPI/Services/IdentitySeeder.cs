using AuthAPI.Data;
using AuthAPI.Models.Entities;

namespace AuthAPI.Services
{
    public class IdentitySeeder
    {
        private readonly AuthDbContext _context;

        public IdentitySeeder(AuthDbContext context)
        {
            _context = context;
        }

        public async Task SeedAsync()
        {
            // Seed Roles
            if (!_context.Roles.Any())
            {
                var roles = new List<Role>
                {
                    new Role { Name = "SystemAdmin", Description = "System Administrator with full access" },
                    new Role { Name = "Manager", Description = "Manager with approval permissions" },
                    new Role { Name = "Employee", Description = "Regular employee with basic access" },
                    new Role { Name = "Guard", Description = "Security guard for entry/exit management" },
                    new Role { Name = "Admin", Description = "Human Resources with user management access" }
                };

                _context.Roles.AddRange(roles);
                await _context.SaveChangesAsync();
                Console.WriteLine("✅ Seeded 5 roles");
            }

            // Seed Permissions (basic set)
            if (!_context.Permissions.Any())
            {
                var permissions = new List<Permission>
                {
                    new Permission { Name = "attendance.view", Resource = "attendance", Action = "view", Description = "View attendance records" },
                    new Permission { Name = "attendance.create", Resource = "attendance", Action = "create", Description = "Mark attendance" },
                    new Permission { Name = "attendance.approve", Resource = "attendance", Action = "approve", Description = "Approve attendance" },
                    new Permission { Name = "leave.view", Resource = "leave", Action = "view", Description = "View leave requests" },
                    new Permission { Name = "leave.create", Resource = "leave", Action = "create", Description = "Create leave request" },
                    new Permission { Name = "user.view", Resource = "user", Action = "view", Description = "View users" },
                    new Permission { Name = "user.create", Resource = "user", Action = "create", Description = "Create users" },
                    new Permission { Name = "labour.register", Resource = "labour", Action = "register", Description = "Register labour" },
                    new Permission { Name = "entry.record", Resource = "entry", Action = "record", Description = "Record entry/exit" },
                    new Permission { Name = "visitor.register", Resource = "visitor", Action = "register", Description = "Register visitors" },
                    new Permission { Name = "report.view", Resource = "report", Action = "view", Description = "View reports" }
                };

                _context.Permissions.AddRange(permissions);
                await _context.SaveChangesAsync();
                Console.WriteLine($"✅ Seeded {permissions.Count} permissions");
            }

            // Seed Role-Permission mappings
            if (!_context.RolePermissions.Any())
            {
                var adminRole = _context.Roles.First(r => r.Name == "SystemAdmin");
                var managerRole = _context.Roles.First(r => r.Name == "Manager");
                var employeeRole = _context.Roles.First(r => r.Name == "Employee");
                var guardRole = _context.Roles.First(r => r.Name == "Guard");
                var adminHRRole = _context.Roles.First(r => r.Name == "Admin");

                var allPermissions = _context.Permissions.ToList();
                var rolePermissions = new List<RolePermission>();

                // SystemAdmin gets everything
                foreach (var p in allPermissions)
                    rolePermissions.Add(new RolePermission { RoleId = adminRole.Id, PermissionId = p.Id });

                // Manager - most except user.create
                var managerPermissions = allPermissions.Where(p => p.Name != "user.create");
                foreach (var p in managerPermissions)
                    rolePermissions.Add(new RolePermission { RoleId = managerRole.Id, PermissionId = p.Id });

                // Employee - attendance.view, attendance.create, leave.view
                var employeePermissions = allPermissions.Where(p => p.Name == "attendance.view" || p.Name == "attendance.create" || p.Name == "leave.view" || p.Name == "report.view");
                foreach (var p in employeePermissions)
                    rolePermissions.Add(new RolePermission { RoleId = employeeRole.Id, PermissionId = p.Id });

                // Guard - entry, visitor, labour
                var guardPermissions = allPermissions.Where(p => p.Resource == "entry" || p.Resource == "visitor" || p.Resource == "labour");
                foreach (var p in guardPermissions)
                    rolePermissions.Add(new RolePermission { RoleId = guardRole.Id, PermissionId = p.Id });

                // Admin (HR) - user management
                var adminPermissions = allPermissions.Where(p => p.Resource == "user" || p.Resource == "report");
                foreach (var p in adminPermissions)
                    rolePermissions.Add(new RolePermission { RoleId = adminHRRole.Id, PermissionId = p.Id });

                _context.RolePermissions.AddRange(rolePermissions);
                await _context.SaveChangesAsync();
                Console.WriteLine($"✅ Seeded {rolePermissions.Count} role-permission mappings");
            }

            // Seed Tenants
            if (!_context.Tenants.Any())
            {
                var tenants = new List<Tenant>
                {
                    new Tenant { Name = "Attendance System", Domain = "attendance", IsActive = true },
                    new Tenant { Name = "Entry/Exit System", Domain = "entryexit", IsActive = true }
                };

                _context.Tenants.AddRange(tenants);
                await _context.SaveChangesAsync();
                Console.WriteLine("✅ Seeded 2 tenants");
            }

            // Seed Test Users (requested set)
            if (!_context.Users.Any())
            {
                var users = new List<User>
                {
                    new User
                    {
                        Username = "SystemAdmin@vermillion.com",
                        Email = "SystemAdmin@vermillion.com",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("SystemAdmin@123"),
                        IsActive = true,
                    },
                    new User
                    {
                        Username = "admin.attendance@vermillion.com",
                        Email = "admin.attendance@vermillion.com",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
                        IsActive = true,
                    },
                    new User
                    {
                        Username = "manager.attendance@vermillion.com",
                        Email = "manager.attendance@vermillion.com",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("Manager@123"),
                        IsActive = true,
                    },
                    new User
                    {
                        Username = "employee1@vermillion.com",
                        Email = "employee1@vermillion.com",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("Employee@123"),
                        IsActive = true,
                    },
                    new User
                    {
                        Username = "admin.entryexit@vermillion.com",
                        Email = "admin.entryexit@vermillion.com",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
                        IsActive = true,
                    },
                    new User
                    {
                        Username = "manager.entryexit@vermillion.com",
                        Email = "manager.entryexit@vermillion.com",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("Manager@123"),
                        IsActive = true,
                    },
                    new User
                    {
                        Username = "guard1@vermillion.com",
                        Email = "guard1@vermillion.com",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("Guard@123"),
                        IsActive = true,
                    }
                };

                _context.Users.AddRange(users);
                await _context.SaveChangesAsync();
                Console.WriteLine($"✅ Seeded {users.Count} test users");
            }

            // Seed User-Role-Tenant mappings
            if (!_context.UserRoles.Any())
            {
                var attendanceTenant = _context.Tenants.First(t => t.Domain == "attendance");
                var entryexitTenant = _context.Tenants.First(t => t.Domain == "entryexit");

                var systemAdminRole = _context.Roles.First(r => r.Name == "SystemAdmin");
                var managerRole = _context.Roles.First(r => r.Name == "Manager");
                var employeeRole = _context.Roles.First(r => r.Name == "Employee");
                var guardRole = _context.Roles.First(r => r.Name == "Guard");
                var adminRole = _context.Roles.First(r => r.Name == "Admin");

                var admin = _context.Users.First(u => u.Email == "SystemAdmin@vermillion.com");
                var adminAttendance = _context.Users.First(u => u.Email == "admin.attendance@vermillion.com");
                var managerAttendance = _context.Users.First(u => u.Email == "manager.attendance@vermillion.com");
                var employee1 = _context.Users.First(u => u.Email == "employee1@vermillion.com");
                var adminEntryExit = _context.Users.First(u => u.Email == "admin.entryexit@vermillion.com");
                var managerEntryExit = _context.Users.First(u => u.Email == "manager.entryexit@vermillion.com");
                var guard1 = _context.Users.First(u => u.Email == "guard1@vermillion.com");

                var userRoles = new List<UserRole>
                {
                    // SystemAdmin - SystemAdmin role in both tenants
                    new UserRole { UserId = admin.Id, RoleId = systemAdminRole.Id, TenantId = attendanceTenant.Id },
                    new UserRole { UserId = admin.Id, RoleId = systemAdminRole.Id, TenantId = entryexitTenant.Id },

                    // Admin (Attendance) - Admin role in attendance tenant
                    new UserRole { UserId = adminAttendance.Id, RoleId = adminRole.Id, TenantId = attendanceTenant.Id },

                    // Manager (Attendance) - Manager role in attendance tenant
                    new UserRole { UserId = managerAttendance.Id, RoleId = managerRole.Id, TenantId = attendanceTenant.Id },

                    // Employee 1 - Employee role in attendance tenant
                    new UserRole { UserId = employee1.Id, RoleId = employeeRole.Id, TenantId = attendanceTenant.Id },

                    // Admin (EntryExit) - Admin role in entryexit tenant
                    new UserRole { UserId = adminEntryExit.Id, RoleId = adminRole.Id, TenantId = entryexitTenant.Id },

                    // Guard 1 - Guard role in entryexit tenant
                    new UserRole { UserId = guard1.Id, RoleId = guardRole.Id, TenantId = entryexitTenant.Id },

                    // Manager (Entry/Exit) - Manager role in entryexit tenant
                    new UserRole { UserId = managerEntryExit.Id, RoleId = managerRole.Id, TenantId = entryexitTenant.Id }
                };

                _context.UserRoles.AddRange(userRoles);
                await _context.SaveChangesAsync();
                Console.WriteLine($"✅ Seeded {userRoles.Count} user-role-tenant mappings");
            }

            // Seed Departments
            if (!_context.Departments.Any())
            {
                var departments = new List<Department>
                {
                    new Department { Name = "Engineering", Description = "Software Engineering Department" },
                    new Department { Name = "Human Resources", Description = "HR Department" },
                    new Department { Name = "Operations", Description = "Operations Department" },
                    new Department { Name = "Security", Description = "Security Department" }
                };

                _context.Departments.AddRange(departments);
                await _context.SaveChangesAsync();
                Console.WriteLine("✅ Seeded 4 departments");
            }

            // Seed Employees
            if (!_context.Employees.Any())
            {
                var engineeringDept = _context.Departments.First(d => d.Name == "Engineering");
                var hrDept = _context.Departments.First(d => d.Name == "Human Resources");
                var operationsDept = _context.Departments.First(d => d.Name == "Operations");
                var securityDept = _context.Departments.First(d => d.Name == "Security");

                // Get all users by email
                var systemAdmin = _context.Users.First(u => u.Email == "SystemAdmin@vermillion.com");
                var adminAttendance = _context.Users.First(u => u.Email == "admin.attendance@vermillion.com");
                var managerAttendance = _context.Users.First(u => u.Email == "manager.attendance@vermillion.com");
                var employee1 = _context.Users.First(u => u.Email == "employee1@vermillion.com");
                var adminEntryExit = _context.Users.First(u => u.Email == "admin.entryexit@vermillion.com");
                var managerEntryExit = _context.Users.First(u => u.Email == "manager.entryexit@vermillion.com");
                var guard1 = _context.Users.First(u => u.Email == "guard1@vermillion.com");

                var employees = new List<Employee>
                {
                    new Employee
                    {
                        UserId = systemAdmin.Id,
                        EmployeeId = "EMP001",
                        FirstName = "System",
                        LastName = "Admin",
                        DepartmentId = engineeringDept.Id,
                        ManagerId = null,
                        PhoneNumber = "+91-9876543210"
                    },
                    new Employee
                    {
                        UserId = adminAttendance.Id,
                        EmployeeId = "EMP002",
                        FirstName = "Admin",
                        LastName = "Attendance",
                        DepartmentId = hrDept.Id,
                        ManagerId = null,
                        PhoneNumber = "+91-9876543211"
                    },
                    new Employee
                    {
                        UserId = managerAttendance.Id,
                        EmployeeId = "EMP003",
                        FirstName = "Manager",
                        LastName = "Attendance",
                        DepartmentId = engineeringDept.Id,
                        ManagerId = null, // Will set after save
                        PhoneNumber = "+91-9876543212"
                    },
                    new Employee
                    {
                        UserId = employee1.Id,
                        EmployeeId = "EMP004",
                        FirstName = "John",
                        LastName = "Doe",
                        DepartmentId = engineeringDept.Id,
                        ManagerId = null, // Will set after save
                        PhoneNumber = "+91-9876543213"
                    },
                    new Employee
                    {
                        UserId = adminEntryExit.Id,
                        EmployeeId = "EMP005",
                        FirstName = "Admin",
                        LastName = "EntryExit",
                        DepartmentId = hrDept.Id,
                        ManagerId = null,
                        PhoneNumber = "+91-9876543214"
                    },
                    new Employee
                    {
                        UserId = managerEntryExit.Id,
                        EmployeeId = "EMP006",
                        FirstName = "Manager",
                        LastName = "EntryExit",
                        DepartmentId = operationsDept.Id,
                        ManagerId = null,
                        PhoneNumber = "+91-9876543215"
                    },
                    new Employee
                    {
                        UserId = guard1.Id,
                        EmployeeId = "GUARD001",
                        FirstName = "Security",
                        LastName = "Guard",
                        DepartmentId = securityDept.Id,
                        ManagerId = null,
                        PhoneNumber = "+91-9876543216"
                    }
                };

                _context.Employees.AddRange(employees);
                await _context.SaveChangesAsync();

                // Set manager relationships
                var systemAdminEmp = employees.First(e => e.EmployeeId == "EMP001");
                var adminAttendanceEmp = employees.First(e => e.EmployeeId == "EMP002");
                var managerAttendanceEmp = employees.First(e => e.EmployeeId == "EMP003");
                var emp4 = employees.First(e => e.EmployeeId == "EMP004");
                var adminEntryExitEmp = employees.First(e => e.EmployeeId == "EMP005");
                var managerEntryExitEmp = employees.First(e => e.EmployeeId == "EMP006");

                // Set SystemAdmin as manager for HR admins
                adminAttendanceEmp.ManagerId = systemAdminEmp.Id;
                adminEntryExitEmp.ManagerId = systemAdminEmp.Id;

                // Set Managers' manager to SystemAdmin
                managerAttendanceEmp.ManagerId = systemAdminEmp.Id;
                managerEntryExitEmp.ManagerId = systemAdminEmp.Id;

                // Set employee's manager to Attendance Manager
                emp4.ManagerId = managerAttendanceEmp.Id;

                await _context.SaveChangesAsync();
                Console.WriteLine($"✅ Seeded {employees.Count} employees with manager relationships");
            }

            Console.WriteLine("\n✅ Identity seeding completed!");
            Console.WriteLine("\n📋 Test User Credentials:");
            Console.WriteLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            Console.WriteLine("Email                 | Password      | Role         | Tenant(s)");
            Console.WriteLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            Console.WriteLine("SystemAdmin@vermillion.com | SystemAdmin@123 | SystemAdmin | attendance, entryexit");
            Console.WriteLine("admin.attendance@vermillion.com | Admin@123   | Admin      | attendance");
            Console.WriteLine("manager.attendance@vermillion.com | Manager@123   | Manager      | attendance");
            Console.WriteLine("employee1@vermillion.com | Employee@123  | Employee     | attendance");
            Console.WriteLine("admin.entryexit@vermillion.com | Admin@123   | Admin      | entryexit");
            Console.WriteLine("manager.entryexit@vermillion.com | Manager@123   | Manager      | entryexit");
            Console.WriteLine("guard1@vermillion.com | Guard@123     | Guard        | entryexit");
            Console.WriteLine("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        }
    }
}
