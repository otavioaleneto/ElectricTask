--
-- PostgreSQL database cluster dump
--

\restrict OBRIEnPCePd2SF231FyDyLN5EBLrBTVcyrbEHx11VLTbXaCkRlPwOSAsDvGgrLA

SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

--
-- Drop databases (except postgres and template1)
--

DROP DATABASE heliumdb;




--
-- Drop roles
--

DROP ROLE postgres;


--
-- Roles
--

CREATE ROLE postgres;
ALTER ROLE postgres WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:fqLtdXbP9v2h+DnDoujOlw==$lsTdmxMKCRjvA/Mow/p3nKGbMYngfoRQ8dpPyomzjn0=:P4OmvZlqzcWFKS0908b7ahmYc1b5y1szcxCFIGMFXls=';

--
-- User Configurations
--








\unrestrict OBRIEnPCePd2SF231FyDyLN5EBLrBTVcyrbEHx11VLTbXaCkRlPwOSAsDvGgrLA

--
-- Databases
--

--
-- Database "template1" dump
--

--
-- PostgreSQL database dump
--

\restrict bxL5GWxBqbccRbBnf814LxTdu0YQcW3wn2tnlf6nln2Kh1cB8lGrrSunm1hE9wn

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

UPDATE pg_catalog.pg_database SET datistemplate = false WHERE datname = 'template1';
DROP DATABASE template1;
--
-- Name: template1; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE template1 WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'C.UTF-8';


ALTER DATABASE template1 OWNER TO postgres;

\unrestrict bxL5GWxBqbccRbBnf814LxTdu0YQcW3wn2tnlf6nln2Kh1cB8lGrrSunm1hE9wn
\connect template1
\restrict bxL5GWxBqbccRbBnf814LxTdu0YQcW3wn2tnlf6nln2Kh1cB8lGrrSunm1hE9wn

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: DATABASE template1; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON DATABASE template1 IS 'default template for new databases';


--
-- Name: template1; Type: DATABASE PROPERTIES; Schema: -; Owner: postgres
--

ALTER DATABASE template1 IS_TEMPLATE = true;


\unrestrict bxL5GWxBqbccRbBnf814LxTdu0YQcW3wn2tnlf6nln2Kh1cB8lGrrSunm1hE9wn
\connect template1
\restrict bxL5GWxBqbccRbBnf814LxTdu0YQcW3wn2tnlf6nln2Kh1cB8lGrrSunm1hE9wn

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: DATABASE template1; Type: ACL; Schema: -; Owner: postgres
--

REVOKE CONNECT,TEMPORARY ON DATABASE template1 FROM PUBLIC;
GRANT CONNECT ON DATABASE template1 TO PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict bxL5GWxBqbccRbBnf814LxTdu0YQcW3wn2tnlf6nln2Kh1cB8lGrrSunm1hE9wn

--
-- Database "heliumdb" dump
--

--
-- PostgreSQL database dump
--

\restrict 3jVlaPFWK6qgOdSdQS35t6NXwfgwuORGqFGisnkZ1GvXdALdPWpXMb50FisceyP

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: heliumdb; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE heliumdb WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'C.UTF-8';


ALTER DATABASE heliumdb OWNER TO postgres;

\unrestrict 3jVlaPFWK6qgOdSdQS35t6NXwfgwuORGqFGisnkZ1GvXdALdPWpXMb50FisceyP
\connect heliumdb
\restrict 3jVlaPFWK6qgOdSdQS35t6NXwfgwuORGqFGisnkZ1GvXdALdPWpXMb50FisceyP

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_log (
    id integer NOT NULL,
    task_id integer NOT NULL,
    user_id integer,
    action text NOT NULL,
    detail text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.activity_log OWNER TO postgres;

--
-- Name: activity_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.activity_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.activity_log_id_seq OWNER TO postgres;

--
-- Name: activity_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.activity_log_id_seq OWNED BY public.activity_log.id;


--
-- Name: checklist_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.checklist_items (
    id integer NOT NULL,
    content text NOT NULL,
    done boolean DEFAULT false NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    checklist_id integer NOT NULL
);


ALTER TABLE public.checklist_items OWNER TO postgres;

--
-- Name: checklist_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.checklist_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.checklist_items_id_seq OWNER TO postgres;

--
-- Name: checklist_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.checklist_items_id_seq OWNED BY public.checklist_items.id;


--
-- Name: checklists; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.checklists (
    id integer NOT NULL,
    task_id integer NOT NULL,
    title text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.checklists OWNER TO postgres;

--
-- Name: checklists_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.checklists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.checklists_id_seq OWNER TO postgres;

--
-- Name: checklists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.checklists_id_seq OWNED BY public.checklists.id;


--
-- Name: columns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.columns (
    id integer NOT NULL,
    project_id integer NOT NULL,
    name text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    color text DEFAULT '#ef4444'::text NOT NULL
);


ALTER TABLE public.columns OWNER TO postgres;

--
-- Name: columns_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.columns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.columns_id_seq OWNER TO postgres;

--
-- Name: columns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.columns_id_seq OWNED BY public.columns.id;


--
-- Name: comment_mentions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comment_mentions (
    id integer NOT NULL,
    comment_id integer NOT NULL,
    user_id integer NOT NULL
);


ALTER TABLE public.comment_mentions OWNER TO postgres;

--
-- Name: comment_mentions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.comment_mentions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comment_mentions_id_seq OWNER TO postgres;

--
-- Name: comment_mentions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.comment_mentions_id_seq OWNED BY public.comment_mentions.id;


--
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comments (
    id integer NOT NULL,
    task_id integer NOT NULL,
    user_id integer NOT NULL,
    body text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.comments OWNER TO postgres;

--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comments_id_seq OWNER TO postgres;

--
-- Name: comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;


--
-- Name: item_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.item_links (
    id integer NOT NULL,
    workspace_id integer NOT NULL,
    source_note_id integer NOT NULL,
    target_type text NOT NULL,
    target_id integer NOT NULL
);


ALTER TABLE public.item_links OWNER TO postgres;

--
-- Name: item_links_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.item_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.item_links_id_seq OWNER TO postgres;

--
-- Name: item_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.item_links_id_seq OWNED BY public.item_links.id;


--
-- Name: labels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.labels (
    id integer NOT NULL,
    project_id integer NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#3b82f6'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.labels OWNER TO postgres;

--
-- Name: labels_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.labels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.labels_id_seq OWNER TO postgres;

--
-- Name: labels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.labels_id_seq OWNED BY public.labels.id;


--
-- Name: mindmaps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mindmaps (
    id integer NOT NULL,
    workspace_id integer NOT NULL,
    name text NOT NULL,
    data jsonb DEFAULT '{"edges": [], "nodes": []}'::jsonb NOT NULL,
    task_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    parent_id integer
);


ALTER TABLE public.mindmaps OWNER TO postgres;

--
-- Name: mindmaps_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.mindmaps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mindmaps_id_seq OWNER TO postgres;

--
-- Name: mindmaps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.mindmaps_id_seq OWNED BY public.mindmaps.id;


--
-- Name: notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notes (
    id integer NOT NULL,
    workspace_id integer NOT NULL,
    title text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    is_locked boolean DEFAULT false NOT NULL
);


ALTER TABLE public.notes OWNER TO postgres;

--
-- Name: notes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notes_id_seq OWNER TO postgres;

--
-- Name: notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notes_id_seq OWNED BY public.notes.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type text NOT NULL,
    task_id integer NOT NULL,
    actor_id integer,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: project_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_views (
    id integer NOT NULL,
    user_id integer NOT NULL,
    project_id integer NOT NULL,
    last_viewed_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.project_views OWNER TO postgres;

--
-- Name: project_views_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.project_views_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.project_views_id_seq OWNER TO postgres;

--
-- Name: project_views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.project_views_id_seq OWNED BY public.project_views.id;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    id integer NOT NULL,
    workspace_id integer NOT NULL,
    name text NOT NULL,
    description text,
    cover_image_url text,
    platform text DEFAULT 'generic'::text NOT NULL,
    accent_color text DEFAULT '#ef4444'::text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    type text DEFAULT 'social'::text NOT NULL
);


ALTER TABLE public.projects OWNER TO postgres;

--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.projects_id_seq OWNER TO postgres;

--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: task_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_attachments (
    id integer NOT NULL,
    task_id integer NOT NULL,
    name text NOT NULL,
    content_type text NOT NULL,
    size integer NOT NULL,
    object_path text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    uploaded_by integer
);


ALTER TABLE public.task_attachments OWNER TO postgres;

--
-- Name: task_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.task_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.task_attachments_id_seq OWNER TO postgres;

--
-- Name: task_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.task_attachments_id_seq OWNED BY public.task_attachments.id;


--
-- Name: task_labels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_labels (
    id integer NOT NULL,
    task_id integer NOT NULL,
    label_id integer NOT NULL
);


ALTER TABLE public.task_labels OWNER TO postgres;

--
-- Name: task_labels_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.task_labels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.task_labels_id_seq OWNER TO postgres;

--
-- Name: task_labels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.task_labels_id_seq OWNED BY public.task_labels.id;


--
-- Name: task_video_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_video_links (
    id integer NOT NULL,
    task_id integer NOT NULL,
    url text NOT NULL,
    label text,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_video_links OWNER TO postgres;

--
-- Name: task_video_links_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.task_video_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.task_video_links_id_seq OWNER TO postgres;

--
-- Name: task_video_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.task_video_links_id_seq OWNED BY public.task_video_links.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    project_id integer NOT NULL,
    column_id integer NOT NULL,
    title text NOT NULL,
    description text,
    priority text DEFAULT 'medium'::text NOT NULL,
    due_date text,
    "position" integer DEFAULT 0 NOT NULL,
    mindmap_id integer,
    completed boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    assignee_id integer,
    type text DEFAULT 'standard'::text NOT NULL
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tasks_id_seq OWNER TO postgres;

--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: time_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.time_entries (
    id integer NOT NULL,
    task_id integer NOT NULL,
    user_id integer NOT NULL,
    started_at timestamp without time zone DEFAULT now() NOT NULL,
    ended_at timestamp without time zone,
    duration_seconds integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.time_entries OWNER TO postgres;

--
-- Name: time_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.time_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.time_entries_id_seq OWNER TO postgres;

--
-- Name: time_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.time_entries_id_seq OWNED BY public.time_entries.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    password_hash text NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    avatar_url text,
    theme text DEFAULT 'dark'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: workspace_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workspace_members (
    id integer NOT NULL,
    workspace_id integer NOT NULL,
    user_id integer NOT NULL,
    role text DEFAULT 'editor'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.workspace_members OWNER TO postgres;

--
-- Name: workspace_members_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.workspace_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workspace_members_id_seq OWNER TO postgres;

--
-- Name: workspace_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.workspace_members_id_seq OWNED BY public.workspace_members.id;


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workspaces (
    id integer NOT NULL,
    owner_id integer NOT NULL,
    name text NOT NULL,
    description text,
    color text DEFAULT '#ef4444'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.workspaces OWNER TO postgres;

--
-- Name: workspaces_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.workspaces_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workspaces_id_seq OWNER TO postgres;

--
-- Name: workspaces_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.workspaces_id_seq OWNED BY public.workspaces.id;


--
-- Name: activity_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_log ALTER COLUMN id SET DEFAULT nextval('public.activity_log_id_seq'::regclass);


--
-- Name: checklist_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_items ALTER COLUMN id SET DEFAULT nextval('public.checklist_items_id_seq'::regclass);


--
-- Name: checklists id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklists ALTER COLUMN id SET DEFAULT nextval('public.checklists_id_seq'::regclass);


--
-- Name: columns id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.columns ALTER COLUMN id SET DEFAULT nextval('public.columns_id_seq'::regclass);


--
-- Name: comment_mentions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_mentions ALTER COLUMN id SET DEFAULT nextval('public.comment_mentions_id_seq'::regclass);


--
-- Name: comments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);


--
-- Name: item_links id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_links ALTER COLUMN id SET DEFAULT nextval('public.item_links_id_seq'::regclass);


--
-- Name: labels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.labels ALTER COLUMN id SET DEFAULT nextval('public.labels_id_seq'::regclass);


--
-- Name: mindmaps id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mindmaps ALTER COLUMN id SET DEFAULT nextval('public.mindmaps_id_seq'::regclass);


--
-- Name: notes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notes ALTER COLUMN id SET DEFAULT nextval('public.notes_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: project_views id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_views ALTER COLUMN id SET DEFAULT nextval('public.project_views_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: task_attachments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_attachments ALTER COLUMN id SET DEFAULT nextval('public.task_attachments_id_seq'::regclass);


--
-- Name: task_labels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_labels ALTER COLUMN id SET DEFAULT nextval('public.task_labels_id_seq'::regclass);


--
-- Name: task_video_links id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_video_links ALTER COLUMN id SET DEFAULT nextval('public.task_video_links_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: time_entries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_entries ALTER COLUMN id SET DEFAULT nextval('public.time_entries_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: workspace_members id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_members ALTER COLUMN id SET DEFAULT nextval('public.workspace_members_id_seq'::regclass);


--
-- Name: workspaces id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspaces ALTER COLUMN id SET DEFAULT nextval('public.workspaces_id_seq'::regclass);


--
-- Data for Name: activity_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activity_log (id, task_id, user_id, action, detail, created_at) FROM stdin;
44	23	9	timer_started	\N	2026-06-30 04:34:30.753322
45	23	9	completed	\N	2026-06-30 04:34:36.434471
12	34	9	created	\N	2026-06-29 22:56:48.469132
13	34	9	moved	Projetos	2026-06-29 22:57:51.547868
14	35	9	created	\N	2026-06-29 22:57:58.379585
82	23	9	timer_paused	31073	2026-06-30 13:12:23.424246
83	23	9	reopened	\N	2026-06-30 15:42:45.641093
211	424	9	created	\N	2026-07-01 03:12:34.847245
22	23	9	timer_started	\N	2026-06-30 03:55:12.137896
23	23	9	timer_paused	10	2026-06-30 03:55:22.309712
156	305	9	created	\N	2026-07-01 02:49:24.356208
157	306	9	created	\N	2026-07-01 02:50:10.642634
158	307	9	created	\N	2026-07-01 02:50:19.158321
159	308	9	created	\N	2026-07-01 02:50:30.807905
160	309	9	created	\N	2026-07-01 02:50:42.10104
42	23	9	timer_started	\N	2026-06-30 04:34:14.425696
43	23	9	timer_paused	5	2026-06-30 04:34:19.32086
\.


--
-- Data for Name: checklist_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.checklist_items (id, content, done, "position", checklist_id) FROM stdin;
21	Fazer roteiro	t	0	9
22	Gravar vídeo	f	1	9
23	Editar vídeo	f	2	9
24	Definir thumbnail	f	0	10
25	Escrever descrição	f	1	10
26	Preparar set	t	0	11
27	Gravar tomadas	t	1	11
28	Áudio extra	f	2	11
29	Capturar clipes	t	0	12
30	Escolher trilha	f	1	12
31	bgb	f	3	9
\.


--
-- Data for Name: checklists; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.checklists (id, task_id, title, "position") FROM stdin;
9	23	Criar Vídeo	0
10	23	Divulgação	1
11	24	Produção	0
12	29	Edição	0
\.


--
-- Data for Name: columns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.columns (id, project_id, name, "position", color) FROM stdin;
318	285	A Fazer	0	#ef4444
319	285	Em Progresso	1	#f59e0b
320	285	Concluído	2	#22c55e
46	16	A Fazer	1	#ef4444
49	16	Projetos	0	#22c55e
28	9	Publicado	3	#22c55e
29	10	Ideias	0	#ef4444
30	10	Em Produção	1	#f59e0b
31	10	Revisão	2	#3b82f6
32	10	Publicado	3	#22c55e
33	11	Ideias	0	#ef4444
34	11	Em Produção	1	#f59e0b
35	11	Revisão	2	#3b82f6
36	11	Publicado	3	#22c55e
27	9	Revisão	2	#3b82f6
26	9	Em Produção	1	#f59e0b
25	9	Ideias	0	#ef4444
48	16	Concluído	3	#22c55e
47	16	Em Progresso	2	#f59e0b
\.


--
-- Data for Name: comment_mentions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.comment_mentions (id, comment_id, user_id) FROM stdin;
\.


--
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.comments (id, task_id, user_id, body, created_at) FROM stdin;
\.


--
-- Data for Name: item_links; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.item_links (id, workspace_id, source_note_id, target_type, target_id) FROM stdin;
10	7	11	note	6
11	7	11	mindmap	8
\.


--
-- Data for Name: labels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.labels (id, project_id, name, color, created_at) FROM stdin;
\.


--
-- Data for Name: mindmaps; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.mindmaps (id, workspace_id, name, data, task_id, created_at, parent_id) FROM stdin;
3	5	Estratégia de Conteúdo	{"areas": [], "edges": [{"id": "e1", "source": "n1", "target": "n2"}, {"id": "e2", "source": "n1", "target": "n3"}, {"id": "e3", "source": "n1", "target": "n4"}, {"id": "e4", "source": "n2", "target": "n5"}, {"id": "e5", "source": "n3", "target": "n6"}], "nodes": [{"x": 420, "y": 60, "id": "n1", "icon": "FaHouse", "color": "#ef4444", "label": "Estratégia 2026", "details": "Foco em crescimento orgânico multiplataforma. Meta: dobrar a base de inscritos e aumentar o engajamento em 30% até o final do ano."}, {"x": 257.58926174496645, "y": 220, "id": "n2", "color": "#ef4444", "label": "YouTube", "details": "Canal principal. Publicar 1 vídeo longo por semana e priorizar tutoriais aprofundados sobre os temas mais buscados."}, {"x": 420, "y": 240, "id": "n3", "color": "#ec4899", "label": "Instagram", "details": "Postar 1 carrossel educativo por dia e stories diarios."}, {"x": 680, "y": 220, "id": "n4", "color": "#06b6d4", "label": "TikTok"}, {"x": 216.61336912751676, "y": 283.88037583892617, "id": "n5", "color": null, "label": "Vídeos longos"}, {"x": 420, "y": 380, "id": "n6", "color": null, "label": "Reels diários"}, {"x": 167.4520968872538, "y": 107.60503789659502, "id": "n1782858099949", "type": "project", "color": "#ef4444", "label": "Canal no YouTube", "details": null, "projectId": 9}]}	\N	2026-06-29 01:26:59.064094	\N
7	7	Speedy Games Downloads	{"areas": [], "edges": [{"id": "emr1ima7pesmebi", "source": "nmr1ily963ta2qi", "target": "nmr1i67z8niacnt", "directed": false}, {"id": "emr1inzlthqzz52", "source": "nmr1ily963ta2qi", "target": "nmr1imckg3tz2g7", "directed": false}, {"id": "emr1iqzyyuf6k99", "source": "nmr1i67z8niacnt", "target": "nmr1iqsppkbyirw", "directed": false}, {"id": "emr1irik3ylen90", "source": "nmr1iqsppkbyirw", "target": "nmr1iraigvkr5ci", "directed": false}, {"id": "emr1it0crw1vdca", "source": "nmr1iryjn1k9bay", "target": "nmr1iqsppkbyirw", "directed": false}, {"id": "emr1ivvthecg7fw", "source": "nmr1i67z8niacnt", "target": "nmr1ivm7agdzmfk", "directed": false}, {"id": "emr1iwdaydrm792", "source": "nmr1ivm7agdzmfk", "target": "nmr1iw1k0wagonw", "directed": false}, {"id": "emr1ixy80m3lrmm", "source": "nmr1ixo2ybgin1u", "target": "nmr1ivm7agdzmfk", "directed": false}, {"id": "emr1izcx7jkn1vu", "source": "nmr1iz2bcjjzvc8", "target": "nmr1ily963ta2qi", "directed": false}, {"id": "emr1izmgoy11ff2", "source": "nmr1izf0qshf08g", "target": "nmr1ily963ta2qi", "directed": false}, {"id": "emr1izzrljou9yb", "source": "nmr1izslucnksl8", "target": "nmr1ily963ta2qi", "directed": false}, {"id": "emr1jbfcvki2udw", "source": "nmr1jb18a4kqwnw", "target": "nmr1iqsppkbyirw", "directed": false}, {"id": "emr1jbs2ch3dk7e", "source": "nmr1jbh8uwimot2", "target": "nmr1iqsppkbyirw", "directed": false}, {"id": "emr1kgofwlcu3mu", "source": "nmr1irlk43j30vn", "target": "nmr1iqsppkbyirw", "directed": false}, {"id": "emr1kh66qep9u20", "source": "nmr1iwkv8c8877e", "target": "nmr1ivm7agdzmfk", "directed": false}, {"id": "emr26x0ihgf32hs", "source": "nmr1ily963ta2qi", "target": "nmr26ws34le4ct8", "directed": false}], "nodes": [{"x": 281.004055120339, "y": -38.58331768237389, "id": "nmr1i67z8niacnt", "icon": null, "type": "text", "color": "#ef4444", "label": "Speedy Games Downloads", "details": null, "projectId": null}, {"x": -69.27232605859291, "y": 64.79730218549733, "id": "nmr1ily963ta2qi", "icon": null, "type": "text", "color": "#f59e0b", "label": "Operacional", "details": null, "projectId": null}, {"x": -13.38267598679775, "y": 242.3159628794129, "id": "nmr1imckg3tz2g7", "icon": null, "type": "text", "color": "#3b82f6", "label": "Hospedagem", "details": null, "projectId": null}, {"x": 318.00405512033905, "y": 64.79730218549733, "id": "nmr1iqsppkbyirw", "icon": null, "type": "text", "color": "#8b5cf6", "label": "Serviços", "details": null, "projectId": null}, {"x": 388.78423090663034, "y": 171.3159628794129, "id": "nmr1iraigvkr5ci", "icon": null, "type": "text", "color": "#ec4899", "label": "Site", "details": null, "projectId": null}, {"x": 395.00405512033905, "y": 233.03372776058438, "id": "nmr1irlk43j30vn", "icon": null, "type": "text", "color": "#ef4444", "label": "GodStix", "details": null, "projectId": null}, {"x": 398.3873743457447, "y": 294.75805140922506, "id": "nmr1iryjn1k9bay", "icon": null, "type": "text", "color": "#f59e0b", "label": "Avatar Item Download", "details": null, "projectId": null}, {"x": 625.3572681318682, "y": 64.79730218549733, "id": "nmr1ivm7agdzmfk", "icon": null, "type": "text", "color": "#3b82f6", "label": "Ferramentas para funcionamento", "details": null, "projectId": null}, {"x": 699.2995608448854, "y": 180.28920877600643, "id": "nmr1iw1k0wagonw", "icon": null, "type": "text", "color": "#22c55e", "label": "Rclone Bridge Web", "details": null, "projectId": null}, {"x": 699.2995608448854, "y": 234.35894749694734, "id": "nmr1iwkv8c8877e", "icon": null, "type": "text", "color": "#8b5cf6", "label": "Game Link Checker", "details": null, "projectId": null}, {"x": 699.0839280407116, "y": 289.1890102382051, "id": "nmr1ixo2ybgin1u", "icon": null, "type": "text", "color": "#ec4899", "label": "Onedrive Link Generator", "details": null, "projectId": null}, {"x": -11.74811407613521, "y": 298.1890102382051, "id": "nmr1iz2bcjjzvc8", "icon": null, "type": "text", "color": "#ef4444", "label": "Cupom Facil", "details": null, "projectId": null}, {"x": -13.38267598679775, "y": 352.0337277605844, "id": "nmr1izf0qshf08g", "icon": null, "type": "text", "color": "#f59e0b", "label": "Cakto", "details": null, "projectId": null}, {"x": -13.38267598679775, "y": 407.38213375554534, "id": "nmr1izslucnksl8", "icon": null, "type": "text", "color": "#3b82f6", "label": "Dominio", "details": null, "projectId": null}, {"x": 395.8392248195447, "y": 354.525665457547, "id": "nmr1jb18a4kqwnw", "icon": null, "type": "text", "color": "#22c55e", "label": "GodStix Server (.apk)", "details": null, "projectId": null}, {"x": 398.3873743457447, "y": 421.38213375554534, "id": "nmr1jbh8uwimot2", "icon": null, "type": "text", "color": "#8b5cf6", "label": "Aurora Asset Manager (.apk)", "details": null, "projectId": null}, {"x": -11.74811407613521, "y": 153.18901023820513, "id": "nmr26ws34le4ct8", "type": "mindmap", "color": "#ec4899", "label": "Nuvens", "details": null, "mindmapId": 8, "projectId": null}]}	\N	2026-07-01 03:14:55.207732	\N
8	7	Nuvens	{"areas": [{"x": 3, "y": 88, "id": "amr1jzbed6psba9", "color": "#ef4444", "label": "Direct Link", "width": 360, "height": 303}, {"x": 370, "y": 90, "id": "amr1jzo1f5vtdxh", "color": "#f59e0b", "label": "Usuario Gratis", "width": 317, "height": 298}, {"x": 691, "y": 89, "id": "amr1jzs7ciu3odb", "color": "#3b82f6", "label": "Webdav", "width": 334, "height": 299}], "edges": [{"id": "emr1jya4o5v56zj", "source": "nmr1jivopkoo81b", "target": "nmr1j86beqso8xr", "directed": false}, {"id": "emr1jybo4plw6sm", "source": "nmr1jj69l3hjtak", "target": "nmr1j86beqso8xr", "directed": false}, {"id": "emr1jyd4kqavpim", "source": "nmr1jje5hzssvfe", "target": "nmr1j86beqso8xr", "directed": false}, {"id": "emr1jygzb0ow5l4", "source": "nmr1jjusey5iyq4", "target": "nmr1j8cw0hufk8m", "directed": false}, {"id": "emr1jyic3yb7nfa", "source": "nmr1jk6ao5e9vg0", "target": "nmr1j8cw0hufk8m", "directed": false}, {"id": "emr1jyjq759myl5", "source": "nmr1jkebut99ymb", "target": "nmr1j8mq8euvirh", "directed": false}, {"id": "emr1jyl0ec9uui4", "source": "nmr1jkm7qa9yaz5", "target": "nmr1j8mq8euvirh", "directed": false}, {"id": "emr1jz7od2ndxqu", "source": "nmr1jz1g1vw5hf6", "target": "nmr1j86beqso8xr", "directed": false}, {"id": "emr1jz8yszhmi2q", "source": "nmr1jz1g1vw5hf6", "target": "nmr1j8cw0hufk8m", "directed": false}, {"id": "emr1jzadhbzjqw6", "source": "nmr1jz1g1vw5hf6", "target": "nmr1j8mq8euvirh", "directed": false}], "nodes": [{"x": 20.525579781101868, "y": 132.29105709951745, "id": "nmr1j86beqso8xr", "icon": null, "type": "text", "color": "#ef4444", "label": "Onedrive", "details": null, "projectId": null}, {"x": 433.9390289691871, "y": 123.3766934682194, "id": "nmr1j8cw0hufk8m", "icon": null, "type": "text", "color": "#f59e0b", "label": "Send.now", "details": null, "projectId": null}, {"x": 744.4140831282218, "y": 146.34450624718232, "id": "nmr1j8mq8euvirh", "icon": null, "type": "text", "color": "#3b82f6", "label": "Quotaless.cloud", "details": null, "projectId": null}, {"x": 18.40864063742768, "y": 199.37316714349356, "id": "nmr1jivopkoo81b", "icon": null, "type": "text", "color": "#22c55e", "label": "Onedrive Padrão", "details": null, "projectId": null}, {"x": 20.098030613613787, "y": 257.06173409974184, "id": "nmr1jj69l3hjtak", "icon": null, "type": "text", "color": "#8b5cf6", "label": "Onedrive Backup", "details": null, "projectId": null}, {"x": 22.968300393003688, "y": 321.2477182808742, "id": "nmr1jje5hzssvfe", "icon": null, "type": "text", "color": "#ec4899", "label": "Onedrive Stix", "details": null, "projectId": null}, {"x": 420.3218985981571, "y": 218.5367913810578, "id": "nmr1jjusey5iyq4", "icon": null, "type": "text", "color": "#ef4444", "label": "Send1", "details": null, "projectId": null}, {"x": 422.99201600613344, "y": 282.9680017007741, "id": "nmr1jk6ao5e9vg0", "icon": null, "type": "text", "color": "#f59e0b", "label": "Send11", "details": null, "projectId": null}, {"x": 746.396323636902, "y": 206.44236891817332, "id": "nmr1jkebut99ymb", "icon": null, "type": "text", "color": "#3b82f6", "label": "Stix", "details": null, "projectId": null}, {"x": 750.7287833409405, "y": 274.6635592272065, "id": "nmr1jkm7qa9yaz5", "icon": null, "type": "text", "color": "#22c55e", "label": "Speedy Games", "details": null, "projectId": null}, {"x": 440.1990416081833, "y": 9.96721266002308, "id": "nmr1jz1g1vw5hf6", "icon": null, "type": "text", "color": "#8b5cf6", "label": "Nuvens", "details": null, "projectId": null}, {"x": 175.58195405490977, "y": 329.42046054802233, "id": "nmr1k0qnxe262hj", "type": "hotspot", "color": "#ec4899", "label": "7 contas", "details": null, "projectId": null}, {"x": 189.04453244276507, "y": 204.997947992945, "id": "nmr1k13d79tklpa", "type": "hotspot", "color": "#ef4444", "label": "20 contas", "details": null, "projectId": null}, {"x": 188.1723417028801, "y": 265.3304467304118, "id": "nmr1k1gsg2owfaz", "type": "hotspot", "color": "#f59e0b", "label": "20 contas", "details": null, "projectId": null}, {"x": 519.0248126386281, "y": 226.64491208671268, "id": "nmr1k29nnjk08ai", "type": "hotspot", "color": "#3b82f6", "label": "Vencimento dia 10/08", "details": null, "projectId": null}, {"x": 512.7491110752737, "y": 296.00963738064235, "id": "nmr1k2o7h08obrc", "type": "hotspot", "color": "#22c55e", "label": "Vencimento 10/08", "details": null, "projectId": null}]}	\N	2026-07-01 03:42:41.797829	7
\.


--
-- Data for Name: notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notes (id, workspace_id, title, content, created_at, updated_at, is_locked) FROM stdin;
5	5	3,		2026-06-29 15:09:29.352296	2026-06-29 15:09:29.352296	f
6	7	Teste	sss	2026-07-01 03:56:14.924581	2026-07-01 03:56:21.837	f
8	5	Link		2026-07-01 05:13:05.611628	2026-07-01 05:13:05.611628	f
11	7	h	[[Teste]][[Nuvens]]	2026-07-01 15:19:48.073891	2026-07-01 15:20:12.961	f
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, type, task_id, actor_id, read, created_at) FROM stdin;
\.


--
-- Data for Name: project_views; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_views (id, user_id, project_id, last_viewed_at) FROM stdin;
4	9	11	2026-06-29 01:47:27.496919
3	9	9	2026-07-01 04:30:05.046
87	9	16	2026-07-01 15:19:32.148
36	11	9	2026-06-29 13:40:29.065026
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.projects (id, workspace_id, name, description, cover_image_url, platform, accent_color, "position", created_at, type) FROM stdin;
285	7	Gilbert Albuquerque	\N	\N	youtube	#ef4444	0	2026-07-01 02:49:05.859569	social
9	5	Canal no YouTube	Vídeos longos e cortes semanais	https://picsum.photos/seed/youtube-studio/960/540	youtube	#ef4444	0	2026-06-29 01:26:58.95185	social
10	5	Instagram	Reels, carrosséis e stories	https://picsum.photos/seed/instagram-feed/960/540	instagram	#ec4899	1	2026-06-29 01:26:58.957364	social
11	5	TikTok	Tendências e vídeos curtos	https://picsum.photos/seed/tiktok-trends/960/540	tiktok	#06b6d4	2	2026-06-29 01:26:58.962192	social
12	6	Marca XYZ - LinkedIn	Gestão de presença corporativa	https://picsum.photos/seed/linkedin-brand/960/540	linkedin	#0a66c2	0	2026-06-29 01:26:58.969423	social
16	7	SpeedyGames	\N	\N	generic	#8b5cf6	0	2026-06-29 22:56:19.067344	development
\.


--
-- Data for Name: task_attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_attachments (id, task_id, name, content_type, size, object_path, created_at, uploaded_by) FROM stdin;
\.


--
-- Data for Name: task_labels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_labels (id, task_id, label_id) FROM stdin;
\.


--
-- Data for Name: task_video_links; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_video_links (id, task_id, url, label, "position", created_at) FROM stdin;
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tasks (id, project_id, column_id, title, description, priority, due_date, "position", mindmap_id, completed, created_at, assignee_id, type) FROM stdin;
308	16	49	Speedy Games Downloads	<p>Controle de informações do SpeedyGamesDownloads<br><br><strong>Frentes:</strong><br>- Site<br><br><strong>Site</strong></p><ul><li><p>Codigo fonte: PHP</p></li><li><p>Conexão: Speedy Cupom, CMS GodStix</p></li></ul><p></p>	low	\N	5	\N	f	2026-07-01 02:50:30.807905	\N	standard
26	9	28	Publicar: tour pelo setup	\N	low	\N	0	\N	t	2026-06-29 01:26:59.015136	\N	standard
27	9	28	Publicar: Q&A com inscritos	\N	low	\N	1	\N	t	2026-06-29 01:26:59.020949	\N	standard
28	10	29	Carrossel: dicas de produtividade	\N	medium	\N	0	\N	f	2026-06-29 01:26:59.028189	\N	standard
29	10	30	Reel: bastidores da semana	\N	high	2026-07-02	0	\N	f	2026-06-29 01:26:59.031686	\N	standard
30	10	32	Stories: enquete com seguidores	\N	low	\N	0	\N	t	2026-06-29 01:26:59.044081	\N	standard
31	11	33	Trend do momento - adaptar	\N	high	\N	0	\N	f	2026-06-29 01:26:59.052246	\N	standard
32	11	34	Série: 3 partes sobre edição	\N	medium	\N	0	\N	f	2026-06-29 01:26:59.055591	\N	standard
33	11	36	Publicar: receita rápida	\N	low	\N	0	\N	t	2026-06-29 01:26:59.059688	\N	standard
309	16	49	Simple Download 360	<p>Controle de informações do GodStix<br><br>Frentes:<br>- CMS<br>- Homebrew XEX<br><br>**CMS**<br>- Codigo fonte: Node.js<br>- Conexão: Homebrew XEX<br><br>**Homebrew XEX**<br>- Codigo fonte: C++<br>- Conexão: CMS</p>	low	\N	6	\N	f	2026-07-01 02:50:42.10104	\N	standard
23	9	25	Roteiro: 10 erros de iniciantes	<p>Teste formatacao RT</p><p>565</p><p>5566</p><p></p>	high	\N	0	\N	f	2026-06-29 01:26:58.980951	\N	video
305	16	49	GodStix	<p>Controle de informações do GodStix<br><br><strong>Frentes:</strong><br>* GodStix Script<br>* GodStix XEX (git23@verdeamor.eco)<br>* GodStix Webui<br>* APK Server<br>* CMS<br><br><strong>Script</strong><br>- Codigo fonte: Lua<br>&nbsp;- Versão atual: 1.7<br>- Conexão: CMS<br><br><strong>XEX</strong><br>- Codigo fonte: C e C++<br>- Versão atual: 0.3<br>- Conexão: CMS<br><br><strong>Webui</strong><br>- Codigo fonte: HTML + CSS<br>- Versão atual: 1.7<br>- Conexão: CMS<br><br><strong>APK Server</strong><br>- Codigo fonte: Ruby + Java<br>- Versão atual: 1.7<br>- Conexão: CMS + Webui + GodStix Script<br><br><strong>CMS</strong><br>- Codigo fonte: Node.JS<br>- Versão atual: xx<br>- Conexão: Webui, GodStix Script, GodStix XEX, Apk Server</p>	low	\N	7	\N	f	2026-07-01 02:49:24.356208	\N	standard
24	9	26	Gravar review do produto	\N	medium	2026-07-05	1	\N	f	2026-06-29 01:26:59.000298	\N	standard
25	9	27	Editar vlog da viagem	\N	medium	\N	0	\N	f	2026-06-29 01:26:59.01132	\N	standard
34	16	49	RcloneBridge Web 	<p><strong>Conta:</strong> git25@verdeamor.eco</p>	low	\N	0	\N	f	2026-06-29 22:56:48.469132	\N	standard
424	16	49	Avatar Item Download	<p>Controle de informações do&nbsp;&nbsp;Avatar item download<br><br><strong>Frentes:</strong><br>- CMS<br><br><strong>CMS</strong><br>- Codigo fonte: Node.js + Java<br>- Conexão: Avatar Download, WebUi</p>	low	\N	8	\N	f	2026-07-01 03:12:34.847245	\N	standard
35	16	49	Vision Cast	<p><strong>Conta:</strong> git27@verdeamor.eco</p>	low	\N	1	\N	f	2026-06-29 22:57:58.379585	\N	standard
306	16	49	Aurora Asset Editor	<p><strong>Conta:</strong> git27@verdeamor.eco</p>	low	\N	3	\N	f	2026-07-01 02:50:10.642634	\N	standard
307	16	49	Speedy Cupom	<p>Controle de informações do Speedy Cupom<br><br><strong>Frentes:</strong><br>- Site<br><br><strong>Site</strong><br>Codigo fonte: Node.js</p>	low	\N	4	\N	f	2026-07-01 02:50:19.158321	\N	standard
\.


--
-- Data for Name: time_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.time_entries (id, task_id, user_id, started_at, ended_at, duration_seconds, created_at) FROM stdin;
19	23	9	2026-06-30 04:34:30.753	2026-06-30 13:12:23.423	31073	2026-06-30 04:34:30.753322
5	23	9	2026-06-30 03:55:12.138	2026-06-30 03:55:22.309	10	2026-06-30 03:55:12.137896
18	23	9	2026-06-30 04:34:14.426	2026-06-30 04:34:19.32	5	2026-06-30 04:34:14.425696
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, name, password_hash, role, avatar_url, theme, created_at) FROM stdin;
10	admin@user.com	Bruno Admin	80f1f8680fb238b7613d2842b435e6b2:c7628024073e5cb63fccc12d8dbfa8356765c2665bf936ebc9fe3f2c7a1477c9c8b236952bbf6c7e8182755ca649dde1d72d278277d17bd4af9229d58a0b03c3	admin	\N	dark	2026-06-29 01:26:58.87196
11	carla@user.com	Carla Mendes	4ab15f0571ec36a7bf2990a3f33c8db5:7f1d37a0d2178760814484de363ec8b4bf595a2c9319235bddf9161d9891112d54e6c02d5bf347e4e24e1277ae994cf661e20a67329a4cb950a779bc6458f3c4	user	\N	light	2026-06-29 01:26:58.939886
12	diego@user.com	Diego Santos	9f1c461b4e6da959c01b43aa5ef7465e:ccad44752c36e2f67dbc701f2fc3bd84b14ac4fcf83430fdb6a743ba87a58dac92e9e2a2f9c27321537c00637be32b5e6f27d021b6857d67f4992946ef37b45c	user	\N	dark	2026-06-29 01:26:58.939886
9	teste@user.com	Ana Criadora	00925ace2d6fd2fc96b1795f2c1e2467:1b68df1ac9b71845062cb1235944338400a980089bd933dee303dfccf7480fceaf98427d06f80a13a167f2b5b78e839d0d00bf6b8c9424d20df237359a5a113a	user	\N	dark	2026-06-29 01:26:58.824703
\.


--
-- Data for Name: workspace_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.workspace_members (id, workspace_id, user_id, role, created_at) FROM stdin;
1	5	9	owner	2026-06-29 02:05:59.254691
2	6	9	owner	2026-06-29 02:05:59.254691
7	7	9	owner	2026-06-29 22:56:04.607776
\.


--
-- Data for Name: workspaces; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.workspaces (id, owner_id, name, description, color, created_at) FROM stdin;
5	9	Estúdio de Conteúdo	Planejamento de todos os canais e redes	#ef4444	2026-06-29 01:26:58.94471
6	9	Clientes & Agência	Projetos de clientes e parcerias	#8b5cf6	2026-06-29 01:26:58.948487
7	9	Organização	\N	#ef4444	2026-06-29 22:56:04.438473
\.


--
-- Name: activity_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.activity_log_id_seq', 435, true);


--
-- Name: checklist_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.checklist_items_id_seq', 31, true);


--
-- Name: checklists_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.checklists_id_seq', 12, true);


--
-- Name: columns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.columns_id_seq', 950, true);


--
-- Name: comment_mentions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.comment_mentions_id_seq', 2, true);


--
-- Name: comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.comments_id_seq', 2, true);


--
-- Name: item_links_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.item_links_id_seq', 11, true);


--
-- Name: labels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.labels_id_seq', 1, false);


--
-- Name: mindmaps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.mindmaps_id_seq', 15, true);


--
-- Name: notes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notes_id_seq', 11, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 13, true);


--
-- Name: project_views_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.project_views_id_seq', 208, true);


--
-- Name: projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.projects_id_seq', 915, true);


--
-- Name: task_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.task_attachments_id_seq', 233, true);


--
-- Name: task_labels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.task_labels_id_seq', 1, false);


--
-- Name: task_video_links_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.task_video_links_id_seq', 201, true);


--
-- Name: tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tasks_id_seq', 944, true);


--
-- Name: time_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.time_entries_id_seq', 271, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 910, true);


--
-- Name: workspace_members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.workspace_members_id_seq', 7, true);


--
-- Name: workspaces_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.workspaces_id_seq', 905, true);


--
-- Name: activity_log activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);


--
-- Name: checklist_items checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_items
    ADD CONSTRAINT checklist_items_pkey PRIMARY KEY (id);


--
-- Name: checklists checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklists
    ADD CONSTRAINT checklists_pkey PRIMARY KEY (id);


--
-- Name: columns columns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.columns
    ADD CONSTRAINT columns_pkey PRIMARY KEY (id);


--
-- Name: comment_mentions comment_mentions_comment_id_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_mentions
    ADD CONSTRAINT comment_mentions_comment_id_user_id_unique UNIQUE (comment_id, user_id);


--
-- Name: comment_mentions comment_mentions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_mentions
    ADD CONSTRAINT comment_mentions_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: item_links item_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_links
    ADD CONSTRAINT item_links_pkey PRIMARY KEY (id);


--
-- Name: labels labels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_pkey PRIMARY KEY (id);


--
-- Name: mindmaps mindmaps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mindmaps
    ADD CONSTRAINT mindmaps_pkey PRIMARY KEY (id);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: project_views project_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_views
    ADD CONSTRAINT project_views_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: task_attachments task_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_pkey PRIMARY KEY (id);


--
-- Name: task_labels task_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_labels
    ADD CONSTRAINT task_labels_pkey PRIMARY KEY (id);


--
-- Name: task_labels task_labels_task_id_label_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_labels
    ADD CONSTRAINT task_labels_task_id_label_id_unique UNIQUE (task_id, label_id);


--
-- Name: task_video_links task_video_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_video_links
    ADD CONSTRAINT task_video_links_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: time_entries time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_workspace_id_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_user_id_unique UNIQUE (workspace_id, user_id);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: item_links_source_target_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX item_links_source_target_uniq ON public.item_links USING btree (source_note_id, target_type, target_id);


--
-- Name: item_links_target_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX item_links_target_idx ON public.item_links USING btree (workspace_id, target_type, target_id);


--
-- Name: item_links_workspace_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX item_links_workspace_idx ON public.item_links USING btree (workspace_id);


--
-- Name: notes_workspace_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notes_workspace_idx ON public.notes USING btree (workspace_id);


--
-- Name: notifications_due_soon_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX notifications_due_soon_unique ON public.notifications USING btree (user_id, task_id) WHERE (type = 'due_soon'::text);


--
-- Name: notifications_user_inbox_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notifications_user_inbox_idx ON public.notifications USING btree (user_id, read, created_at);


--
-- Name: project_views_user_project_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX project_views_user_project_unique ON public.project_views USING btree (user_id, project_id);


--
-- Name: time_entries_one_running_per_user_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX time_entries_one_running_per_user_task ON public.time_entries USING btree (task_id, user_id) WHERE (ended_at IS NULL);


--
-- Name: activity_log activity_log_task_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: activity_log activity_log_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: checklist_items checklist_items_checklist_id_checklists_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklist_items
    ADD CONSTRAINT checklist_items_checklist_id_checklists_id_fk FOREIGN KEY (checklist_id) REFERENCES public.checklists(id) ON DELETE CASCADE;


--
-- Name: checklists checklists_task_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checklists
    ADD CONSTRAINT checklists_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: columns columns_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.columns
    ADD CONSTRAINT columns_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: comment_mentions comment_mentions_comment_id_comments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_mentions
    ADD CONSTRAINT comment_mentions_comment_id_comments_id_fk FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: comment_mentions comment_mentions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_mentions
    ADD CONSTRAINT comment_mentions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: comments comments_task_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: comments comments_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: item_links item_links_source_note_id_notes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_links
    ADD CONSTRAINT item_links_source_note_id_notes_id_fk FOREIGN KEY (source_note_id) REFERENCES public.notes(id) ON DELETE CASCADE;


--
-- Name: item_links item_links_workspace_id_workspaces_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_links
    ADD CONSTRAINT item_links_workspace_id_workspaces_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: labels labels_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: mindmaps mindmaps_parent_id_mindmaps_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mindmaps
    ADD CONSTRAINT mindmaps_parent_id_mindmaps_id_fk FOREIGN KEY (parent_id) REFERENCES public.mindmaps(id) ON DELETE SET NULL;


--
-- Name: mindmaps mindmaps_workspace_id_workspaces_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mindmaps
    ADD CONSTRAINT mindmaps_workspace_id_workspaces_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: notes notes_workspace_id_workspaces_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_workspace_id_workspaces_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_actor_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_actor_id_users_id_fk FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_task_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_views project_views_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_views
    ADD CONSTRAINT project_views_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_views project_views_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_views
    ADD CONSTRAINT project_views_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_workspace_id_workspaces_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_workspace_id_workspaces_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: task_attachments task_attachments_task_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_attachments task_attachments_uploaded_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_uploaded_by_users_id_fk FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: task_labels task_labels_label_id_labels_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_labels
    ADD CONSTRAINT task_labels_label_id_labels_id_fk FOREIGN KEY (label_id) REFERENCES public.labels(id) ON DELETE CASCADE;


--
-- Name: task_labels task_labels_task_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_labels
    ADD CONSTRAINT task_labels_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_video_links task_video_links_task_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_video_links
    ADD CONSTRAINT task_video_links_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_assignee_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assignee_id_users_id_fk FOREIGN KEY (assignee_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_column_id_columns_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_column_id_columns_id_fk FOREIGN KEY (column_id) REFERENCES public.columns(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: time_entries time_entries_task_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: time_entries time_entries_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_workspace_id_workspaces_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_workspaces_id_fk FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspaces workspaces_owner_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_owner_id_users_id_fk FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 3jVlaPFWK6qgOdSdQS35t6NXwfgwuORGqFGisnkZ1GvXdALdPWpXMb50FisceyP

--
-- Database "postgres" dump
--

--
-- PostgreSQL database dump
--

\restrict 25yTiKTWzfMZ6EUgGgW2MkjajClu6tevYlsAf2Mvu4tkbUfBqYx3xa9E9bwBgRy

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP DATABASE postgres;
--
-- Name: postgres; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE postgres WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'C.UTF-8';


ALTER DATABASE postgres OWNER TO postgres;

\unrestrict 25yTiKTWzfMZ6EUgGgW2MkjajClu6tevYlsAf2Mvu4tkbUfBqYx3xa9E9bwBgRy
\connect postgres
\restrict 25yTiKTWzfMZ6EUgGgW2MkjajClu6tevYlsAf2Mvu4tkbUfBqYx3xa9E9bwBgRy

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: DATABASE postgres; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON DATABASE postgres IS 'default administrative connection database';


--
-- PostgreSQL database dump complete
--

\unrestrict 25yTiKTWzfMZ6EUgGgW2MkjajClu6tevYlsAf2Mvu4tkbUfBqYx3xa9E9bwBgRy

--
-- PostgreSQL database cluster dump complete
--

