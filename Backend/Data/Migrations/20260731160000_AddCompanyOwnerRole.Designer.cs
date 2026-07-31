using Blueprint.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Blueprint.Api.Data.Migrations;

[DbContext(typeof(BlueprintDbContext))]
[Migration("20260731160000_AddCompanyOwnerRole")]
partial class AddCompanyOwnerRole { protected override void BuildTargetModel(ModelBuilder modelBuilder) { } }
