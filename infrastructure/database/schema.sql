-- UniChat Enterprise - Core PostgreSQL Schema
-- Designed for Multi-Tenancy (Row-Level Security Prepared)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tenants (Institutions)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'atc' for Arusha Technical College
    domain VARCHAR(255) UNIQUE,
    logo_url TEXT,
    plan VARCHAR(50) DEFAULT 'starter',  -- 'starter', 'growth', 'enterprise'
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'pending', 'suspended', 'inactive'
    max_users INT DEFAULT 500,
    branding JSONB DEFAULT '{}', -- colors, fonts, etc.
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- nullable: platform-level users (superadmin) have no tenant
    email VARCHAR(255),
    phone VARCHAR(20),
    student_id VARCHAR(50), -- Institutional ID
    staff_id VARCHAR(50),   -- Institutional ID
    full_name VARCHAR(255) NOT NULL,
    password_hash TEXT,
    role VARCHAR(50) DEFAULT 'student', -- 'student', 'staff', 'admin', 'superadmin'
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    UNIQUE(tenant_id, email),
    UNIQUE(tenant_id, student_id),
    UNIQUE(tenant_id, staff_id)
);
-- Ensure unique email across all superadmin accounts (tenant_id IS NULL)
CREATE UNIQUE INDEX idx_users_platform_email ON users(email) WHERE tenant_id IS NULL;

-- 3. Academic Hierarchy
CREATE TABLE faculties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    faculty_id UUID NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cohorts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g., 'Year 2 CS - 2026'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Groups & Channels
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) DEFAULT 'private', -- 'private', 'public', 'course', 'club', 'announcement'
    academic_context_id UUID, -- Links to department_id, cohort_id, or course_id
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_members (
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member', -- 'member', 'admin', 'moderator'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id)
);

-- 5. Messaging
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'video', 'file', 'voice', 'poll'
    metadata JSONB DEFAULT '{}',     -- replies, reactions, file info
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Sessions & Security
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    device_info JSONB,
    ip_address VARCHAR(45),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_groups_tenant ON groups(tenant_id);
CREATE INDEX idx_messages_group ON messages(group_id);
CREATE INDEX idx_messages_tenant_created ON messages(tenant_id, created_at DESC);
