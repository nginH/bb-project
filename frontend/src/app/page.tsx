'use client';
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { role: "user" as const, content: input };
    setMessages((msgs) => [...msgs, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, sessionId }),
      });

      if (!res.ok) throw new Error("Failed to fetch");
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantReply = "";

      setMessages((msgs) => [...msgs, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            if (dataStr === "[DONE]") continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                assistantReply += data.content;
                setMessages((msgs) => [
                  ...msgs.slice(0, -1),
                  { role: "assistant", content: assistantReply },
                ]);
              }
            } catch (err) {
              console.warn("Error parsing chunk", err);
            }
          }
        }
      }
    } catch (err) {
      setMessages((msgs) => [
        ...msgs,
        { role: "assistant", content: "Error: Could not get reply." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        /* ── Neumorphic design tokens ── */
        .nm-root {
          --nm-bg: #e8e8e8;
          --nm-shadow-light: #ffffff;
          --nm-shadow-dark: #c5c5c5;
          --nm-inset-bg: #e0e0e0;
          --nm-text: #1a1a1a;
          --nm-text-muted: #777;
          --accent-orange: #f97316;
          --accent-orange-hover: #ea6c09;
          --accent-blue: #3b82f6;
          --accent-blue-hover: #2563eb;
        }
        @media (prefers-color-scheme: dark) {
          .nm-root {
            --nm-bg: #1e1e1e;
            --nm-shadow-light: #2d2d2d;
            --nm-shadow-dark: #0f0f0f;
            --nm-inset-bg: #191919;
            --nm-text: #f0f0f0;
            --nm-text-muted: #888;
          }
        }

        /* ── Layout ── */
        .nm-root {
          min-height: 100vh;
          background: var(--nm-bg);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .nm-panel {
          width: 100%;
          max-width: 680px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* ── Header ── */
        .nm-header {
          text-align: center;
          padding: 18px 24px;
          border-radius: 20px;
          background: var(--nm-bg);
          box-shadow:
            6px 6px 14px var(--nm-shadow-dark),
            -6px -6px 14px var(--nm-shadow-light);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .nm-logo {
          width: 32px; height: 32px;
          border-radius: 10px;
          background: var(--nm-bg);
          box-shadow:
            3px 3px 8px var(--nm-shadow-dark),
            -3px -3px 8px var(--nm-shadow-light);
          display: flex; align-items: center; justify-content: center;
        }
        .nm-logo-inner {
          width: 14px; height: 14px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-orange), var(--accent-blue));
        }
        .nm-title {
          font-size: 20px;
          font-weight: 700;
          background: linear-gradient(135deg, var(--accent-orange), var(--accent-blue));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: 0.3px;
        }
        .nm-status-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 2px var(--nm-bg), 0 0 0 3.5px rgba(34,197,94,0.3);
        }

        /* ── Messages area (inset) ── */
        .nm-messages {
          border-radius: 20px;
          padding: 18px;
          min-height: 420px;
          max-height: 60vh;
          overflow-y: auto;
          background: var(--nm-inset-bg);
          box-shadow:
            inset 5px 5px 12px var(--nm-shadow-dark),
            inset -5px -5px 12px var(--nm-shadow-light);
          display: flex;
          flex-direction: column;
          gap: 14px;
          scroll-behavior: smooth;
        }
        .nm-messages::-webkit-scrollbar { width: 5px; }
        .nm-messages::-webkit-scrollbar-track { background: transparent; }
        .nm-messages::-webkit-scrollbar-thumb {
          background: var(--nm-shadow-dark);
          border-radius: 99px;
        }

        /* ── Message row ── */
        .nm-msg-row { display: flex; flex-direction: column; }
        .nm-msg-row.user { align-items: flex-end; }
        .nm-msg-row.assistant { align-items: flex-start; }

        .nm-sender-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 5px;
          padding: 0 6px;
        }
        .nm-sender-label.user { color: var(--accent-orange); }
        .nm-sender-label.assistant { color: var(--accent-blue); }

        /* ── Bubbles ── */
        .nm-bubble {
          padding: 12px 16px;
          border-radius: 18px;
          max-width: 82%;
          font-size: 14px;
          line-height: 1.6;
          color: var(--nm-text);
          background: var(--nm-bg);
          word-break: break-word;
        }
        .nm-bubble.user {
          border-bottom-right-radius: 4px;
          box-shadow:
            4px 4px 10px var(--nm-shadow-dark),
            -3px -3px 8px var(--nm-shadow-light);
          border: 1.5px solid transparent;
          border-right: 2.5px solid var(--accent-orange);
          border-bottom: 2.5px solid var(--accent-orange);
        }
        .nm-bubble.assistant {
          border-bottom-left-radius: 4px;
          box-shadow:
            4px 4px 10px var(--nm-shadow-dark),
            -3px -3px 8px var(--nm-shadow-light);
          border: 1.5px solid transparent;
          border-left: 2.5px solid var(--accent-blue);
          border-bottom: 2.5px solid var(--accent-blue);
        }

        /* ── Links inside bubbles ── */
        .nm-bubble a {
          color: var(--accent-blue) !important;
          text-decoration: underline;
          text-underline-offset: 2px;
          font-weight: 500;
          transition: color 0.2s;
        }
        .nm-bubble a:hover {
          color: var(--accent-orange) !important;
          text-decoration-color: var(--accent-orange);
        }

        /* ── Markdown inside bubbles ── */
        .nm-bubble p { margin-bottom: 6px; }
        .nm-bubble p:last-child { margin-bottom: 0; }
        .nm-bubble ul { list-style: disc; padding-left: 18px; margin-bottom: 6px; }
        .nm-bubble ol { list-style: decimal; padding-left: 18px; margin-bottom: 6px; }
        .nm-bubble li { margin-bottom: 2px; }
        .nm-bubble code {
          background: var(--nm-inset-bg);
          border-radius: 5px;
          padding: 1px 6px;
          font-size: 12.5px;
          font-family: 'SF Mono', 'Fira Mono', monospace;
          color: var(--accent-orange);
        }
        .nm-bubble pre {
          background: var(--nm-inset-bg);
          box-shadow:
            inset 3px 3px 7px var(--nm-shadow-dark),
            inset -2px -2px 5px var(--nm-shadow-light);
          border-radius: 12px;
          padding: 12px 14px;
          margin: 8px 0;
          overflow-x: auto;
          font-size: 12.5px;
          font-family: 'SF Mono', 'Fira Mono', monospace;
        }
        .nm-bubble pre code {
          background: none;
          padding: 0;
          color: var(--nm-text);
        }
        .nm-bubble strong { font-weight: 600; }
        .nm-bubble blockquote {
          border-left: 3px solid var(--accent-blue);
          margin: 6px 0;
          padding-left: 12px;
          color: var(--nm-text-muted);
          font-style: italic;
        }
        .nm-bubble table {
          border-collapse: collapse;
          width: 100%;
          font-size: 13px;
          margin: 8px 0;
        }
        .nm-bubble th, .nm-bubble td {
          border: 1px solid var(--nm-shadow-dark);
          padding: 6px 10px;
          text-align: left;
        }
        .nm-bubble th {
          background: var(--nm-inset-bg);
          font-weight: 600;
          color: var(--accent-blue);
        }

        /* ── Typing indicator ── */
        .nm-typing {
          display: flex;
          gap: 5px;
          align-items: center;
          padding: 12px 16px;
          border-radius: 18px;
          border-bottom-left-radius: 4px;
          background: var(--nm-bg);
          box-shadow:
            4px 4px 10px var(--nm-shadow-dark),
            -3px -3px 8px var(--nm-shadow-light);
          border-left: 2.5px solid var(--accent-blue);
          border-bottom: 2.5px solid var(--accent-blue);
          width: fit-content;
        }
        .nm-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: var(--accent-blue);
          opacity: 0.35;
          animation: nm-blink 1.2s infinite;
        }
        .nm-dot:nth-child(2) { animation-delay: 0.2s; background: linear-gradient(to right, var(--accent-blue), var(--accent-orange)); }
        .nm-dot:nth-child(3) { animation-delay: 0.4s; background: var(--accent-orange); }
        @keyframes nm-blink {
          0%, 80%, 100% { opacity: 0.25; transform: scale(1); }
          40% { opacity: 1; transform: scale(1.25); }
        }

        /* ── Empty state ── */
        .nm-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: var(--nm-text-muted);
          user-select: none;
        }
        .nm-empty-icon {
          width: 52px; height: 52px;
          border-radius: 50%;
          background: var(--nm-bg);
          box-shadow:
            5px 5px 12px var(--nm-shadow-dark),
            -5px -5px 12px var(--nm-shadow-light);
          display: flex; align-items: center; justify-content: center;
        }
        .nm-empty-icon-inner {
          width: 22px; height: 22px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-orange)33, var(--accent-blue)33);
          border: 2px solid transparent;
          border-image: linear-gradient(135deg, var(--accent-orange), var(--accent-blue)) 1;
          border-radius: 50%;
          box-shadow: 0 0 0 2px var(--accent-orange)22;
        }
        .nm-empty p {
          font-size: 14px;
          color: var(--nm-text-muted);
        }

        /* ── Input row ── */
        .nm-input-row {
          display: flex;
          gap: 10px;
          align-items: center;
          padding: 14px 16px;
          border-radius: 20px;
          background: var(--nm-bg);
          box-shadow:
            6px 6px 14px var(--nm-shadow-dark),
            -6px -6px 14px var(--nm-shadow-light);
        }
        .nm-input-inset {
          flex: 1;
          border-radius: 50px;
          background: var(--nm-inset-bg);
          box-shadow:
            inset 3px 3px 8px var(--nm-shadow-dark),
            inset -3px -3px 8px var(--nm-shadow-light);
          padding: 2px;
        }
        .nm-input {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          padding: 12px 18px;
          font-size: 14px;
          color: var(--nm-text);
          border-radius: 50px;
          font-family: inherit;
        }
        .nm-input::placeholder { color: var(--nm-text-muted); }

        /* ── Send button ── */
        .nm-send-btn {
          width: 48px; height: 48px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          background: var(--nm-bg);
          box-shadow:
            5px 5px 12px var(--nm-shadow-dark),
            -4px -4px 10px var(--nm-shadow-light);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: box-shadow 0.15s, transform 0.1s;
        }
        .nm-send-btn:hover:not(:disabled) {
          box-shadow:
            6px 6px 14px var(--nm-shadow-dark),
            -5px -5px 12px var(--nm-shadow-light);
        }
        .nm-send-btn:active:not(:disabled) {
          box-shadow:
            inset 3px 3px 8px var(--nm-shadow-dark),
            inset -3px -3px 8px var(--nm-shadow-light);
          transform: scale(0.96);
        }
        .nm-send-btn:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
        .nm-send-icon {
          width: 20px; height: 20px;
        }
      `}</style>

      <div className="nm-root">
        <div className="nm-panel">

          {/* Header */}
          <div className="nm-header">
            <div className="nm-logo">
              <div className="nm-logo-inner" />
            </div>
            <span className="nm-title">Assam University </span>
            <div className="nm-status-dot" />
          </div>

          {/* Messages */}
          <div className="nm-messages">
            {messages.length === 0 && (
              <div className="nm-empty">
                <div className="nm-empty-icon">
                  <div className="nm-empty-icon-inner" />
                </div>
                <p>Start the conversation…</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`nm-msg-row ${msg.role}`}>
                <span className={`nm-sender-label ${msg.role}`}>
                  {msg.role === "user" ? "You" : "Bot"}
                </span>
                <div className={`nm-bubble ${msg.role}`}>
                  {msg.content ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ node, ...props }) => (
                          <a {...props} target="_blank" rel="noopener noreferrer" />
                        ),
                        p: ({ node, ...props }) => <p {...props} />,
                        ul: ({ node, ...props }) => <ul {...props} />,
                        ol: ({ node, ...props }) => <ol {...props} />,
                        li: ({ node, ...props }) => <li {...props} />,
                        code: ({ node, ...props }) => <code {...props} />,
                        pre: ({ node, ...props }) => <pre {...props} />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.role === "assistant" && loading ? (
                      <div className="nm-typing">
                        <div className="nm-dot" />
                        <div className="nm-dot" />
                        <div className="nm-dot" />
                      </div>
                    ) : ""
                  )}
                </div>
              </div>
            ))}

            {loading &&
              messages.length > 0 &&
              messages[messages.length - 1].role === "user" && (
                <div className="nm-msg-row assistant">
                  <span className="nm-sender-label assistant">Assam University </span>
                  <div className="nm-bubble assistant">
                    <div className="nm-typing">
                      <div className="nm-dot" />
                      <div className="nm-dot" />
                      <div className="nm-dot" />
                    </div>
                  </div>
                </div>
              )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={sendMessage}
            className="nm-input-row"
          >
            <div className="nm-input-inset">
              <input
                className="nm-input"
                type="text"
                placeholder="Type your message…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="nm-send-btn"
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              <svg
                className="nm-send-icon"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="send-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <path
                  d="M22 2L11 13"
                  stroke="url(#send-grad)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <path
                  d="M22 2L15 22L11 13L2 9L22 2Z"
                  stroke="url(#send-grad)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>

        </div>
      </div>
    </>
  );
}