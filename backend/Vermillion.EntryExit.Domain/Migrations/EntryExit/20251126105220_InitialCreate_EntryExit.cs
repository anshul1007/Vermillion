using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vermillion.EntryExit.Domain.Migrations.EntryExit
{
    /// <inheritdoc />
    public partial class InitialCreate_EntryExit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "entryexit");

            migrationBuilder.CreateTable(
                name: "Projects",
                schema: "entryexit",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Projects", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Contractors",
                schema: "entryexit",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ContactPerson = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PhoneNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ProjectId = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Contractors", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Contractors_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalSchema: "entryexit",
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "GuardProjectAssignments",
                schema: "entryexit",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AuthUserId = table.Column<int>(type: "int", nullable: false),
                    ProjectId = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    AssignedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuardProjectAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GuardProjectAssignments_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalSchema: "entryexit",
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Visitors",
                schema: "entryexit",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    PhoneNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CompanyName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Purpose = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    PhotoUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    RegisteredBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    RegisteredAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ProjectId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Visitors", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Visitors_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalSchema: "entryexit",
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Labours",
                schema: "entryexit",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    PhoneNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    AadharNumberEncrypted = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    PhotoUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ProjectId = table.Column<int>(type: "int", nullable: false),
                    ContractorId = table.Column<int>(type: "int", nullable: false),
                    Barcode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    RegisteredBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    RegisteredAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Labours", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Labours_Contractors_ContractorId",
                        column: x => x.ContractorId,
                        principalSchema: "entryexit",
                        principalTable: "Contractors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Labours_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalSchema: "entryexit",
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EntryExitRecords",
                schema: "entryexit",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PersonType = table.Column<int>(type: "int", nullable: false),
                    LabourId = table.Column<int>(type: "int", nullable: true),
                    VisitorId = table.Column<int>(type: "int", nullable: true),
                    Action = table.Column<int>(type: "int", nullable: false),
                    Timestamp = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Gate = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RecordedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ClientId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EntryExitRecords", x => x.Id);
                    table.CheckConstraint("CK_EntryExitRecord_PersonType", "(PersonType = 1 AND LabourId IS NOT NULL AND VisitorId IS NULL) OR (PersonType = 2 AND VisitorId IS NOT NULL AND LabourId IS NULL)");
                    table.ForeignKey(
                        name: "FK_EntryExitRecords_Labours_LabourId",
                        column: x => x.LabourId,
                        principalSchema: "entryexit",
                        principalTable: "Labours",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EntryExitRecords_Visitors_VisitorId",
                        column: x => x.VisitorId,
                        principalSchema: "entryexit",
                        principalTable: "Visitors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Contractors_ProjectId_Name",
                schema: "entryexit",
                table: "Contractors",
                columns: new[] { "ProjectId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_EntryExitRecords_ClientId",
                schema: "entryexit",
                table: "EntryExitRecords",
                column: "ClientId",
                unique: true,
                filter: "[ClientId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_EntryExitRecords_LabourId_Action_Timestamp",
                schema: "entryexit",
                table: "EntryExitRecords",
                columns: new[] { "LabourId", "Action", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_EntryExitRecords_VisitorId_Action_Timestamp",
                schema: "entryexit",
                table: "EntryExitRecords",
                columns: new[] { "VisitorId", "Action", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_GuardProjectAssignments_AuthUserId_ProjectId",
                schema: "entryexit",
                table: "GuardProjectAssignments",
                columns: new[] { "AuthUserId", "ProjectId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GuardProjectAssignments_ProjectId",
                schema: "entryexit",
                table: "GuardProjectAssignments",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_Labours_ContractorId",
                schema: "entryexit",
                table: "Labours",
                column: "ContractorId");

            migrationBuilder.CreateIndex(
                name: "IX_Labours_PhoneNumber",
                schema: "entryexit",
                table: "Labours",
                column: "PhoneNumber");

            migrationBuilder.CreateIndex(
                name: "IX_Labours_ProjectId_Barcode",
                schema: "entryexit",
                table: "Labours",
                columns: new[] { "ProjectId", "Barcode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Projects_Name",
                schema: "entryexit",
                table: "Projects",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Visitors_PhoneNumber",
                schema: "entryexit",
                table: "Visitors",
                column: "PhoneNumber");

            migrationBuilder.CreateIndex(
                name: "IX_Visitors_ProjectId",
                schema: "entryexit",
                table: "Visitors",
                column: "ProjectId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EntryExitRecords",
                schema: "entryexit");

            migrationBuilder.DropTable(
                name: "GuardProjectAssignments",
                schema: "entryexit");

            migrationBuilder.DropTable(
                name: "Labours",
                schema: "entryexit");

            migrationBuilder.DropTable(
                name: "Visitors",
                schema: "entryexit");

            migrationBuilder.DropTable(
                name: "Contractors",
                schema: "entryexit");

            migrationBuilder.DropTable(
                name: "Projects",
                schema: "entryexit");
        }
    }
}
