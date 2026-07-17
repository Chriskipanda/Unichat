// One-off importer for ATC's real faculty/department/programme structure.
// Idempotent: safe to re-run. Matches existing faculties/departments by name
// first (create-if-missing) rather than assuming a fresh table, since the
// admin may have already added some of these by hand through /admin/departments
// with slightly different casing/spacing than what's hardcoded below.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const STRUCTURE = [
  {
    faculty: 'Faculty of Civil and Built Environment Engineering',
    departments: [
      { name: 'Department of Civil Engineering', programmes: ['Ordinary Diploma in Civil Engineering', 'Bachelor Degree in Civil Engineering'] },
      { name: 'Department of Civil & Highway Engineering', programmes: ['Ordinary Diploma in Civil & Highway Engineering', 'Bachelor Degree in Civil & Highway Engineering'] },
      { name: 'Department of Civil & Irrigation Engineering', programmes: ['Ordinary Diploma in Civil & Irrigation Engineering', 'Bachelor Degree in Civil & Irrigation Engineering'] },
      { name: 'Department of Architecture Engineering', programmes: ['Ordinary Diploma in Architecture Engineering'] },
    ],
  },
  {
    faculty: 'Faculty of Mechanical and Automotive Engineering',
    departments: [
      { name: 'Department of Mechanical Engineering', programmes: ['Ordinary Diploma in Mechanical Engineering', 'Bachelor Degree in Mechanical Engineering'] },
      { name: 'Department of Automotive Engineering', programmes: ['Ordinary Diploma in Automotive Engineering'] },
      { name: 'Department of Automotive Electronics Engineering', programmes: ['Bachelor Degree in Automotive Electronics Engineering'] },
      { name: 'Department of Heavy Duty Equipment Engineering', programmes: ['Ordinary Diploma in Heavy Duty Equipment Engineering'] },
      { name: 'Department of Mechanical & Bio-energy Engineering', programmes: ['Ordinary Diploma in Mechanical & Bio-energy Engineering'] },
    ],
  },
  {
    faculty: 'Faculty of Electrical, Electronics and Biomedical Engineering',
    departments: [
      { name: 'Department of Electrical Engineering', programmes: ['Ordinary Diploma in Electrical Engineering'] },
      { name: 'Department of Electrical & Biomedical Engineering', programmes: ['Ordinary Diploma in Electrical & Biomedical Engineering', 'Bachelor Degree in Electrical & Biomedical Engineering'] },
      { name: 'Department of Auto-electrical & Electronics Engineering', programmes: ['Ordinary Diploma in Auto-electrical & Electronics Engineering'] },
      { name: 'Department of Electronics & Telecommunication Engineering', programmes: ['Ordinary Diploma in Electronics & Telecommunication Engineering'] },
      { name: 'Department of Instrumentation Engineering', programmes: ['Ordinary Diploma in Instrumentation Engineering'] },
    ],
  },
  {
    faculty: 'Faculty of Energy Engineering',
    departments: [
      { name: 'Department of Renewable Energy Engineering', programmes: ['Bachelor Degree in Renewable Energy Engineering'] },
      { name: 'Department of Solar Energy Engineering', programmes: ['Ordinary Diploma in Electrical & Solar Energy Engineering'] },
      { name: 'Department of Wind Energy Engineering', programmes: ['Ordinary Diploma in Electrical & Wind Energy Engineering'] },
      { name: 'Department of Hydropower Engineering', programmes: ['Ordinary Diploma in Electrical & Hydropower Engineering'] },
      { name: 'Department of Oil & Gas Engineering', programmes: ['Ordinary Diploma in Pipe Works, Oil & Gas Engineering'] },
    ],
  },
  {
    faculty: 'Faculty of Computing and Information Technology',
    departments: [
      { name: 'Department of Computer Science', programmes: ['Ordinary Diploma in Computer Science', 'Bachelor Degree in Computer Science'] },
      { name: 'Department of Information Technology', programmes: ['Ordinary Diploma in Information Technology', 'Bachelor Degree in Information Technology'] },
      { name: 'Department of Cyber Security', programmes: ['Ordinary Diploma in Cyber Security & Digital Forensic'] },
      { name: 'Department of Multimedia Technology', programmes: ['Ordinary Diploma in Multimedia & Animation Technology'] },
    ],
  },
  {
    faculty: 'Faculty of Mechatronics and Industrial Engineering',
    departments: [
      { name: 'Department of Mechatronics Engineering', programmes: ['Bachelor Degree in Mechatronics & Material Engineering'] },
    ],
  },
  {
    faculty: 'Faculty of Applied Sciences and Technology',
    departments: [
      { name: 'Department of Laboratory Science', programmes: ['Ordinary Diploma in Laboratory Science & Technology', 'Bachelor Degree in Laboratory Science & Industrial Technology'] },
      { name: 'Department of Geological Engineering', programmes: ['Ordinary Diploma in Geology & Gemstone Processing Engineering'] },
    ],
  },
];

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'atc' } });
  if (!tenant) {
    console.error('Tenant "atc" not found — run the main seed first.');
    process.exit(1);
  }

  let facultiesCreated = 0, deptsCreated = 0, coursesCreated = 0, coursesSkipped = 0;

  for (const { faculty: facultyName, departments } of STRUCTURE) {
    let faculty = await prisma.faculty.findFirst({ where: { tenantId: tenant.id, name: facultyName } });
    if (!faculty) {
      faculty = await prisma.faculty.create({ data: { tenantId: tenant.id, name: facultyName } });
      facultiesCreated++;
      console.log(`+ Faculty: ${facultyName}`);
    }

    for (const { name: deptName, programmes } of departments) {
      let department = await prisma.department.findFirst({ where: { tenantId: tenant.id, facultyId: faculty.id, name: deptName } });
      if (!department) {
        department = await prisma.department.create({ data: { tenantId: tenant.id, facultyId: faculty.id, name: deptName } });
        deptsCreated++;
        console.log(`  + Department: ${deptName}`);
      }

      for (const programmeName of programmes) {
        const existing = await prisma.course.findFirst({ where: { tenantId: tenant.id, departmentId: department.id, name: programmeName } });
        if (existing) {
          coursesSkipped++;
          continue;
        }
        await prisma.course.create({ data: { tenantId: tenant.id, departmentId: department.id, name: programmeName } });
        coursesCreated++;
        console.log(`    + Programme: ${programmeName}`);
      }
    }
  }

  console.log('\nDone.');
  console.log(`  Faculties created: ${facultiesCreated}`);
  console.log(`  Departments created: ${deptsCreated}`);
  console.log(`  Programmes created: ${coursesCreated} (skipped ${coursesSkipped} already present)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
