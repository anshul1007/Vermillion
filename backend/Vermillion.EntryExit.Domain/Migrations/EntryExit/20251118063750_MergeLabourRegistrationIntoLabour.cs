using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vermillion.EntryExit.Domain.Migrations.EntryExit
{
    /// <inheritdoc />
    public partial class MergeLabourRegistrationIntoLabour : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EntryExitRecords_LabourRegistrations_LabourRegistrationId",
                schema: "entryexit",
                table: "EntryExitRecords");

            migrationBuilder.DropTable(
                name: "LabourRegistrations",
                schema: "entryexit");

            migrationBuilder.DropCheckConstraint(
                name: "CK_EntryExitRecord_PersonType",
                schema: "entryexit",
                table: "EntryExitRecords");

            migrationBuilder.RenameColumn(
                name: "LabourRegistrationId",
                schema: "entryexit",
                table: "EntryExitRecords",
                newName: "LabourId");

            migrationBuilder.RenameIndex(
                name: "IX_EntryExitRecords_LabourRegistrationId_Action_Timestamp",
                schema: "entryexit",
                table: "EntryExitRecords",
                newName: "IX_EntryExitRecords_LabourId_Action_Timestamp");

            migrationBuilder.AddColumn<string>(
                name: "Barcode",
                schema: "entryexit",
                table: "Labours",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "ContractorId",
                schema: "entryexit",
                table: "Labours",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                schema: "entryexit",
                table: "Labours",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ProjectId",
                schema: "entryexit",
                table: "Labours",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "RegisteredAt",
                schema: "entryexit",
                table: "Labours",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "GETUTCDATE()");

            migrationBuilder.AddColumn<string>(
                name: "RegisteredBy",
                schema: "entryexit",
                table: "Labours",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Labours_ContractorId",
                schema: "entryexit",
                table: "Labours",
                column: "ContractorId");

            migrationBuilder.CreateIndex(
                name: "IX_Labours_ProjectId_Barcode",
                schema: "entryexit",
                table: "Labours",
                columns: new[] { "ProjectId", "Barcode" },
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_EntryExitRecord_PersonType",
                schema: "entryexit",
                table: "EntryExitRecords",
                sql: "(PersonType = 1 AND LabourId IS NOT NULL AND VisitorId IS NULL) OR (PersonType = 2 AND VisitorId IS NOT NULL AND LabourId IS NULL)");

            migrationBuilder.AddForeignKey(
                name: "FK_EntryExitRecords_Labours_LabourId",
                schema: "entryexit",
                table: "EntryExitRecords",
                column: "LabourId",
                principalSchema: "entryexit",
                principalTable: "Labours",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Labours_Contractors_ContractorId",
                schema: "entryexit",
                table: "Labours",
                column: "ContractorId",
                principalSchema: "entryexit",
                principalTable: "Contractors",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Labours_Projects_ProjectId",
                schema: "entryexit",
                table: "Labours",
                column: "ProjectId",
                principalSchema: "entryexit",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EntryExitRecords_Labours_LabourId",
                schema: "entryexit",
                table: "EntryExitRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_Labours_Contractors_ContractorId",
                schema: "entryexit",
                table: "Labours");

            migrationBuilder.DropForeignKey(
                name: "FK_Labours_Projects_ProjectId",
                schema: "entryexit",
                table: "Labours");

            migrationBuilder.DropIndex(
                name: "IX_Labours_ContractorId",
                schema: "entryexit",
                table: "Labours");

            migrationBuilder.DropIndex(
                name: "IX_Labours_ProjectId_Barcode",
                schema: "entryexit",
                table: "Labours");

            migrationBuilder.DropCheckConstraint(
                name: "CK_EntryExitRecord_PersonType",
                schema: "entryexit",
                table: "EntryExitRecords");

            migrationBuilder.DropColumn(
                name: "Barcode",
                schema: "entryexit",
                table: "Labours");

            migrationBuilder.DropColumn(
                name: "ContractorId",
                schema: "entryexit",
                table: "Labours");

            migrationBuilder.DropColumn(
                name: "IsActive",
                schema: "entryexit",
                table: "Labours");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                schema: "entryexit",
                table: "Labours");

            migrationBuilder.DropColumn(
                name: "RegisteredAt",
                schema: "entryexit",
                table: "Labours");

            migrationBuilder.DropColumn(
                name: "RegisteredBy",
                schema: "entryexit",
                table: "Labours");

            migrationBuilder.RenameColumn(
                name: "LabourId",
                schema: "entryexit",
                table: "EntryExitRecords",
                newName: "LabourRegistrationId");

            migrationBuilder.RenameIndex(
                name: "IX_EntryExitRecords_LabourId_Action_Timestamp",
                schema: "entryexit",
                table: "EntryExitRecords",
                newName: "IX_EntryExitRecords_LabourRegistrationId_Action_Timestamp");

            migrationBuilder.CreateTable(
                name: "LabourRegistrations",
                schema: "entryexit",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ContractorId = table.Column<int>(type: "int", nullable: false),
                    LabourId = table.Column<int>(type: "int", nullable: false),
                    ProjectId = table.Column<int>(type: "int", nullable: false),
                    Barcode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    RegisteredAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    RegisteredBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LabourRegistrations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LabourRegistrations_Contractors_ContractorId",
                        column: x => x.ContractorId,
                        principalSchema: "entryexit",
                        principalTable: "Contractors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LabourRegistrations_Labours_LabourId",
                        column: x => x.LabourId,
                        principalSchema: "entryexit",
                        principalTable: "Labours",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LabourRegistrations_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalSchema: "entryexit",
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_EntryExitRecord_PersonType",
                schema: "entryexit",
                table: "EntryExitRecords",
                sql: "(PersonType = 1 AND LabourRegistrationId IS NOT NULL AND VisitorId IS NULL) OR (PersonType = 2 AND VisitorId IS NOT NULL AND LabourRegistrationId IS NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_LabourRegistrations_ContractorId",
                schema: "entryexit",
                table: "LabourRegistrations",
                column: "ContractorId");

            migrationBuilder.CreateIndex(
                name: "IX_LabourRegistrations_LabourId",
                schema: "entryexit",
                table: "LabourRegistrations",
                column: "LabourId");

            migrationBuilder.CreateIndex(
                name: "IX_LabourRegistrations_ProjectId_Barcode",
                schema: "entryexit",
                table: "LabourRegistrations",
                columns: new[] { "ProjectId", "Barcode" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_EntryExitRecords_LabourRegistrations_LabourRegistrationId",
                schema: "entryexit",
                table: "EntryExitRecords",
                column: "LabourRegistrationId",
                principalSchema: "entryexit",
                principalTable: "LabourRegistrations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
