using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vermillion.EntryExit.Domain.Migrations.EntryExit
{
    /// <inheritdoc />
    public partial class ChangePhotoStorageToBase64 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PhotoUrl",
                schema: "entryexit",
                table: "Visitors");

            migrationBuilder.DropColumn(
                name: "PhotoUrl",
                schema: "entryexit",
                table: "Labours");

            migrationBuilder.AddColumn<string>(
                name: "PhotoBase64",
                schema: "entryexit",
                table: "Visitors",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PhotoBase64",
                schema: "entryexit",
                table: "Labours",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PhotoBase64",
                schema: "entryexit",
                table: "Visitors");

            migrationBuilder.DropColumn(
                name: "PhotoBase64",
                schema: "entryexit",
                table: "Labours");

            migrationBuilder.AddColumn<string>(
                name: "PhotoUrl",
                schema: "entryexit",
                table: "Visitors",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PhotoUrl",
                schema: "entryexit",
                table: "Labours",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);
        }
    }
}
