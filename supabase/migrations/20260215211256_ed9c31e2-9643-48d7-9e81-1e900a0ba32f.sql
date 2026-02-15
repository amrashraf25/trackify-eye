
-- Create updated_at function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'dean', 'doctor', 'student');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Departments table
CREATE TABLE public.departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    code text NOT NULL UNIQUE,
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and deans can manage departments" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dean'));

-- Students table
CREATE TABLE public.students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    student_code text NOT NULL UNIQUE,
    full_name text NOT NULL,
    email text,
    department_id uuid REFERENCES public.departments(id),
    year_level int NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'active',
    avatar_url text,
    phone text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view all students" ON public.students FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dean') OR public.has_role(auth.uid(), 'doctor')
);
CREATE POLICY "Students can view own record" ON public.students FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins and deans can manage students" ON public.students FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dean'));

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Courses table
CREATE TABLE public.courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_code text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    department_id uuid REFERENCES public.departments(id),
    doctor_id uuid REFERENCES auth.users(id),
    credits int NOT NULL DEFAULT 3,
    semester text NOT NULL DEFAULT 'Fall 2024',
    max_students int DEFAULT 40,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view courses" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and deans can manage courses" ON public.courses FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dean'));

-- Enrollments table
CREATE TABLE public.enrollments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    enrolled_at timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL DEFAULT 'enrolled',
    UNIQUE(student_id, course_id)
);
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view enrollments" ON public.enrollments FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dean') OR public.has_role(auth.uid(), 'doctor')
);
CREATE POLICY "Students can view own enrollments" ON public.enrollments FOR SELECT TO authenticated USING (
    student_id IN (SELECT s.id FROM public.students s WHERE s.user_id = auth.uid())
);
CREATE POLICY "Admins and deans can manage enrollments" ON public.enrollments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dean'));

-- Grades table
CREATE TABLE public.grades (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    grade_type text NOT NULL DEFAULT 'exam',
    grade_value numeric(5,2),
    max_value numeric(5,2) DEFAULT 100,
    notes text,
    graded_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view all grades" ON public.grades FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dean') OR public.has_role(auth.uid(), 'doctor')
);
CREATE POLICY "Students can view own grades" ON public.grades FOR SELECT TO authenticated USING (
    student_id IN (SELECT s.id FROM public.students s WHERE s.user_id = auth.uid())
);
CREATE POLICY "Doctors and admins can manage grades" ON public.grades FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dean') OR public.has_role(auth.uid(), 'doctor')
);

-- Add references to existing tables
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id);
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id);
