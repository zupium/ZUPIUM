"""
ZUPIUM - AI Chat Assistant
Backend Flask + Groq API (gratis & cepat, model Llama 3.3 / Mixtral)

Cara jalanin lokal:
    pip install -r requirements.txt
    set GROQ_API_KEY di file .env
    python app.py
"""

import os
import json
import time
import uuid
from datetime import datetime

from flask import Flask, request, jsonify, render_template, Response, stream_with_context
from flask_cors import CORS
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

app = Flask(__name__)
CORS(app)

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
MODEL_NAME = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

SYSTEM_PROMPT = (
    "Kamu adalah ZUPIUM, asisten AI cerdas, ramah, dan to the point. "
    "Jawab dalam Bahasa Indonesia kecuali user memakai bahasa lain. "
    "Gunakan markdown (heading, list, **bold**) dan code block ```bahasa``` "
    "saat menjelaskan kode supaya rapi dibaca."
)

# Penyimpanan history sederhana di memori server.
# Untuk produksi skala besar sebaiknya diganti database (SQLite/Postgres),
# tapi untuk publik gratis & ringan, in-memory + localStorage di client sudah cukup.
CONVERSATIONS = {}


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "model": MODEL_NAME, "configured": bool(GROQ_API_KEY)})


@app.route("/api/chat", methods=["POST"])
def chat():
    """Streaming chat endpoint (Server-Sent Events style chunked response)."""
    if not client:
        return jsonify({"error": "GROQ_API_KEY belum diset di server."}), 500

    data = request.get_json(force=True)
    user_message = (data.get("message") or "").strip()
    history = data.get("history") or []  # [{role, content}, ...] dikirim dari client

    if not user_message:
        return jsonify({"error": "Pesan kosong."}), 400

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    # Batasi history yang dikirim ke model biar tetap cepat & murah token
    for m in history[-20:]:
        if m.get("role") in ("user", "assistant") and m.get("content"):
            messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": user_message})

    def generate():
        try:
            stream = client.chat.completions.create(
                model=MODEL_NAME,
                messages=messages,
                temperature=0.7,
                max_tokens=2048,
                top_p=1,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    payload = json.dumps({"token": delta})
                    yield f"data: {payload}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            err = json.dumps({"error": str(e)})
            yield f"data: {err}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # penting biar Nginx/Render gak buffer SSE
        },
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
