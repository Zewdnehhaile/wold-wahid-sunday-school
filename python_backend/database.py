import os
import firebase_admin
from firebase_admin import credentials, firestore
from pathlib import Path
from config import DATABASE_PATH

# Initialize Firebase Admin SDK
cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccountKey.json")
if os.path.exists(cred_path):
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
else:
    print(f"WARNING: Firebase service account key not found at {cred_path}. Firestore features will fail.")
    db = None

def get_firestore_db():
    return db

# We keep SQLite connection helper for the migration script
import sqlite3
def get_sqlite_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Database initialization for Firestore (rules are deployed via CLI/Console)
def init_db():
    print("Firestore is initialized. Collections are auto-created on first write.")
