/**
 * Smart Enrollment Engine
 * Automatically assigns students to academic groups based on hierarchy.
 */

class EnrollmentService {
    /**
     * Enrolls a student into their mandatory groups
     * @param {string} userId
     * @param {object} academicInfo { tenantId, facultyId, departmentId, cohortId }
     */
    async enrollStudent(userId, academicInfo) {
        const { tenantId, facultyId, departmentId, cohortId } = academicInfo;

        // 1. Join Faculty Announcement Channel
        await this.joinGroup(userId, `faculty_${facultyId}`);

        // 2. Join Department Group
        await this.joinGroup(userId, `dept_${departmentId}`);

        // 3. Join Cohort Group (e.g., Year 2 CS)
        await this.joinGroup(userId, `cohort_${cohortId}`);

        // 4. Join Default Institution Channel
        await this.joinGroup(userId, `tenant_${tenantId}_announcements`);

        console.log(`User ${userId} auto-enrolled into academic structure.`);
    }

    async joinGroup(userId, groupIdentifier) {
        // DB logic to add user to group_members table
        console.log(`[Mock] User ${userId} joined ${groupIdentifier}`);
    }
}

module.exports = new EnrollmentService();
