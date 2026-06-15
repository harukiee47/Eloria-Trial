import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";

// Keywords that get colored bold badges automatically
const WARN_WORDS  = /^(warning|caution|note|important|deprecated|careful)$/i;
const GOOD_WORDS  = /^(✅|done|success|working|correct|fixed|tip|pro tip|recommended)$/i;
const BAD_WORDS   = /^(❌|error|fail|failed|broken|wrong|avoid|never|don't|danger)$/i;

function SmartStrong({ children }) {
  const text = typeof children === "string" ? children : (children?.[0] ?? "");
  const word = text.trim();

  if (WARN_WORDS.test(word)) {
    return <strong className="ec-md-strong" style={{ background:"rgba(234,179,8,.15)", color:"#92610a", border:"1px solid rgba(234,179,8,.3)", padding:"0 5px", borderRadius:4 }}>{children}</strong>;
  }
  if (GOOD_WORDS.test(word)) {
    return <strong className="ec-md-strong" style={{ background:"rgba(34,197,94,.12)", color:"#166534", border:"1px solid rgba(34,197,94,.25)", padding:"0 5px", borderRadius:4 }}>{children}</strong>;
  }
  if (BAD_WORDS.test(word)) {
    return <strong className="ec-md-strong" style={{ background:"rgba(239,68,68,.1)", color:"#991b1b", border:"1px solid rgba(239,68,68,.2)", padding:"0 5px", borderRadius:4 }}>{children}</strong>;
  }

  return <strong className="ec-md-strong">{children}</strong>;
}

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={handleCopy} className="ec-copy-btn" title="Copy code">
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
      <span>{copied ? "Copied!" : "Copy"}</span>
    </button>
  );
};

const MarkdownMessage = ({ content }) => {
  return (
    <div className="ec-markdown">
      <ReactMarkdown
      remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeText = String(children).replace(/\n$/, "");

            if (!inline) {
              return (
                <div className="ec-code-block">
                  <div className="ec-code-header">
                    <span className="ec-code-lang">{match ? match[1] : "code"}</span>
                    <CopyButton text={codeText} />
                  </div>
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match ? match[1] : "text"}
                    PreTag="div"
                    customStyle={{ margin: 0, borderRadius: "0 0 8px 8px", fontSize: "12.5px", background: "#2b2b2b", lineHeight: 1.5 }}
                    {...props}
                  >
                    {codeText}
                  </SyntaxHighlighter>
                </div>
              );
            }

            return <code className="ec-inline-code" {...props}>{children}</code>;
          },

          h1: ({ children }) => <h1 className="ec-md-h1">{children}</h1>,
          h2: ({ children }) => <h2 className="ec-md-h2">{children}</h2>,
          h3: ({ children }) => <h3 className="ec-md-h3">{children}</h3>,

          p: ({ children }) => <p className="ec-md-p">{children}</p>,

          strong: ({ children }) => <SmartStrong>{children}</SmartStrong>,
          em:     ({ children }) => <em className="ec-md-em">{children}</em>,

          ul: ({ children }) => <ul className="ec-md-ul">{children}</ul>,
          ol: ({ children }) => <ol className="ec-md-ol">{children}</ol>,
          li: ({ children }) => <li className="ec-md-li">{children}</li>,

          blockquote: ({ children }) => (
            <blockquote className="ec-md-blockquote">{children}</blockquote>
          ),

          hr: () => <hr className="ec-md-hr" />,

          a: ({ href, children }) => (
            <a href={href} className="ec-md-link" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),

          table: ({ children }) => (
            <div className="ec-md-table-wrap">
              <table className="ec-md-table">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="ec-md-th">{children}</th>,
          td: ({ children }) => <td className="ec-md-td">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownMessage;