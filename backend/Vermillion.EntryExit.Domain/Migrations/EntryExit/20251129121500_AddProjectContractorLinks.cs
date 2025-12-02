using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Vermillion.EntryExit.Domain.Data;

#nullable disable

namespace Vermillion.EntryExit.Domain.Migrations.EntryExit
{
    /// <inheritdoc />
    [DbContext(typeof(EntryExitDbContext))]
    [Migration("20251129121500_AddProjectContractorLinks")]
    public partial class AddProjectContractorLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Contractors_Projects_ProjectId",
                schema: "entryexit",
                table: "Contractors");

            migrationBuilder.DropIndex(
                name: "IX_Contractors_ProjectId_Name",
                schema: "entryexit",
                table: "Contractors");

            migrationBuilder.CreateTable(
                name: "ProjectContractors",
                schema: "entryexit",
                columns: table => new
                {
                    ProjectId = table.Column<int>(type: "int", nullable: false),
                    ContractorId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectContractors", x => new { x.ProjectId, x.ContractorId });
                    table.ForeignKey(
                        name: "FK_ProjectContractors_Contractors_ContractorId",
                        column: x => x.ContractorId,
                        principalSchema: "entryexit",
                        principalTable: "Contractors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProjectContractors_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalSchema: "entryexit",
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectContractors_ContractorId",
                schema: "entryexit",
                table: "ProjectContractors",
                column: "ContractorId");

            migrationBuilder.Sql(@"INSERT INTO entryexit.ProjectContractors (ProjectId, ContractorId) SELECT ProjectId, Id FROM entryexit.Contractors");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                schema: "entryexit",
                table: "Contractors");

            migrationBuilder.CreateIndex(
                name: "IX_Contractors_Name",
                schema: "entryexit",
                table: "Contractors",
                column: "Name");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Contractors_Name",
                schema: "entryexit",
                table: "Contractors");

            migrationBuilder.AddColumn<int>(
                name: "ProjectId",
                schema: "entryexit",
                table: "Contractors",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(@"
UPDATE c
SET ProjectId = pc.ProjectId
FROM entryexit.Contractors c
INNER JOIN (
    SELECT ContractorId, MIN(ProjectId) AS ProjectId
    FROM entryexit.ProjectContractors
    GROUP BY ContractorId
) pc ON c.Id = pc.ContractorId");

            migrationBuilder.DropTable(
                name: "ProjectContractors",
                schema: "entryexit");

            migrationBuilder.CreateIndex(
                name: "IX_Contractors_ProjectId_Name",
                schema: "entryexit",
                table: "Contractors",
                columns: new[] { "ProjectId", "Name" });

            migrationBuilder.AddForeignKey(
                name: "FK_Contractors_Projects_ProjectId",
                schema: "entryexit",
                table: "Contractors",
                column: "ProjectId",
                principalSchema: "entryexit",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
