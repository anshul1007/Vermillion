using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EntryExitAPI.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Labours",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    PhoneNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    AadharNumberEncrypted = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    PhotoUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Labours", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Projects",
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
                name: "Visitors",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    PhoneNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CompanyName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Purpose = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    PhotoUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    RegisteredBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    RegisteredAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Visitors", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Contractors",
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
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "GuardProjectAssignments",
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
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LabourRegistrations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LabourId = table.Column<int>(type: "int", nullable: false),
                    ProjectId = table.Column<int>(type: "int", nullable: false),
                    ContractorId = table.Column<int>(type: "int", nullable: false),
                    Barcode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    RegisteredBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    RegisteredAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LabourRegistrations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LabourRegistrations_Contractors_ContractorId",
                        column: x => x.ContractorId,
                        principalTable: "Contractors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LabourRegistrations_Labours_LabourId",
                        column: x => x.LabourId,
                        principalTable: "Labours",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LabourRegistrations_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EntryExitRecords",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PersonType = table.Column<int>(type: "int", nullable: false),
                    LabourRegistrationId = table.Column<int>(type: "int", nullable: true),
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
                    table.CheckConstraint("CK_EntryExitRecord_PersonType", "(PersonType = 1 AND LabourRegistrationId IS NOT NULL AND VisitorId IS NULL) OR (PersonType = 2 AND VisitorId IS NOT NULL AND LabourRegistrationId IS NULL)");
                    table.ForeignKey(
                        name: "FK_EntryExitRecords_LabourRegistrations_LabourRegistrationId",
                        column: x => x.LabourRegistrationId,
                        principalTable: "LabourRegistrations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EntryExitRecords_Visitors_VisitorId",
                        column: x => x.VisitorId,
                        principalTable: "Visitors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Contractors_ProjectId_Name",
                table: "Contractors",
                columns: new[] { "ProjectId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_EntryExitRecords_ClientId",
                table: "EntryExitRecords",
                column: "ClientId",
                unique: true,
                filter: "[ClientId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_EntryExitRecords_LabourRegistrationId_Action_Timestamp",
                table: "EntryExitRecords",
                columns: new[] { "LabourRegistrationId", "Action", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_EntryExitRecords_VisitorId_Action_Timestamp",
                table: "EntryExitRecords",
                columns: new[] { "VisitorId", "Action", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_GuardProjectAssignments_AuthUserId_ProjectId",
                table: "GuardProjectAssignments",
                columns: new[] { "AuthUserId", "ProjectId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GuardProjectAssignments_ProjectId",
                table: "GuardProjectAssignments",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_LabourRegistrations_ContractorId",
                table: "LabourRegistrations",
                column: "ContractorId");

            migrationBuilder.CreateIndex(
                name: "IX_LabourRegistrations_LabourId",
                table: "LabourRegistrations",
                column: "LabourId");

            migrationBuilder.CreateIndex(
                name: "IX_LabourRegistrations_ProjectId_Barcode",
                table: "LabourRegistrations",
                columns: new[] { "ProjectId", "Barcode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Labours_PhoneNumber",
                table: "Labours",
                column: "PhoneNumber");

            migrationBuilder.CreateIndex(
                name: "IX_Projects_Name",
                table: "Projects",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Visitors_PhoneNumber",
                table: "Visitors",
                column: "PhoneNumber");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EntryExitRecords");

            migrationBuilder.DropTable(
                name: "GuardProjectAssignments");

            migrationBuilder.DropTable(
                name: "LabourRegistrations");

            migrationBuilder.DropTable(
                name: "Visitors");

            migrationBuilder.DropTable(
                name: "Contractors");

            migrationBuilder.DropTable(
                name: "Labours");

            migrationBuilder.DropTable(
                name: "Projects");
        }
    }
}
