using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vermillion.EntryExit.Domain.Migrations.EntryExit
{
    /// <inheritdoc />
    public partial class AddProjectIdToVisitor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add ProjectId column with nullable first
            migrationBuilder.AddColumn<int>(
                name: "ProjectId",
                schema: "entryexit",
                table: "Visitors",
                type: "int",
                nullable: true);

            // Update existing visitors to use the first available project
            migrationBuilder.Sql(@"
                UPDATE v
                SET v.ProjectId = (SELECT TOP 1 Id FROM entryexit.Projects ORDER BY Id)
                FROM entryexit.Visitors v
                WHERE v.ProjectId IS NULL
            ");

            // Make ProjectId non-nullable now that all rows have values
            migrationBuilder.AlterColumn<int>(
                name: "ProjectId",
                schema: "entryexit",
                table: "Visitors",
                type: "int",
                nullable: false);

            migrationBuilder.CreateIndex(
                name: "IX_Visitors_ProjectId",
                schema: "entryexit",
                table: "Visitors",
                column: "ProjectId");

            migrationBuilder.AddForeignKey(
                name: "FK_Visitors_Projects_ProjectId",
                schema: "entryexit",
                table: "Visitors",
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
                name: "FK_Visitors_Projects_ProjectId",
                schema: "entryexit",
                table: "Visitors");

            migrationBuilder.DropIndex(
                name: "IX_Visitors_ProjectId",
                schema: "entryexit",
                table: "Visitors");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                schema: "entryexit",
                table: "Visitors");
        }
    }
}
