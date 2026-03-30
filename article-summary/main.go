package main

import (
	"bytes"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

//go:embed static/*
var staticFiles embed.FS

const (
	n8nEndpoint = "http://localhost:5678/webhook/article-summary"
	serverPort  = ":8090"
)

// Request from the frontend
type SummarizeRequest struct {
	Text string `json:"text"`
}

// Response to the frontend
type SummarizeResponse struct {
	Success  bool        `json:"success"`
	Message  string      `json:"message"`
	Response interface{} `json:"response,omitempty"`
}

func main() {
	mux := http.NewServeMux()

	// Serve static files
	mux.Handle("/static/", http.FileServer(http.FS(staticFiles)))

	// Root -> serve index.html
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		data, err := staticFiles.ReadFile("static/index.html")
		if err != nil {
			http.Error(w, "index.html not found", 500)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(data)
	})

	// API endpoint
	mux.HandleFunc("/api/summarize", handleSummarize)

	// Auto-open browser after a short delay
	go func() {
		time.Sleep(500 * time.Millisecond)
		openBrowser(fmt.Sprintf("http://localhost%s", serverPort))
	}()

	fmt.Printf("Starting Article Summary application: http://localhost%s\n", serverPort)
	fmt.Println("n8n Endpoint:", n8nEndpoint)
	fmt.Println("Press Ctrl+C to close")

	if err := http.ListenAndServe(serverPort, mux); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

func handleSummarize(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "POST" {
		sendError(w, "Only POST method is supported", http.StatusMethodNotAllowed)
		return
	}

	// Read body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		sendError(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Parse the incoming request
	var req SummarizeRequest
	if err := json.Unmarshal(body, &req); err != nil {
		// If it's not valid JSON, treat the raw body as text
		req.Text = string(body)
	}

	// Clean the text
	text := sanitizeText(req.Text)
	if strings.TrimSpace(text) == "" {
		sendError(w, "Text cannot be empty", http.StatusBadRequest)
		return
	}

	// Build JSON payload for n8n
	payload := map[string]string{"text": text}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		sendError(w, "Failed to create JSON", http.StatusInternalServerError)
		return
	}

	log.Printf("📤 Sending to n8n (%d characters)...\n", len(text))

	// Send to n8n
	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Post(n8nEndpoint, "application/json", bytes.NewReader(payloadBytes))
	if err != nil {
		sendError(w, fmt.Sprintf("Failed to connect to n8n: %v", err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		sendError(w, "Failed to read n8n response", http.StatusBadGateway)
		return
	}

	log.Printf("✅ n8n response received (HTTP %d)\n", resp.StatusCode)

	// Try to parse n8n response as JSON
	var n8nResp interface{}
	if err := json.Unmarshal(respBody, &n8nResp); err != nil {
		// Not JSON, return as string
		n8nResp = string(respBody)
	}

	result := SummarizeResponse{
		Success:  resp.StatusCode >= 200 && resp.StatusCode < 300,
		Message:  fmt.Sprintf("n8n response code: %d", resp.StatusCode),
		Response: n8nResp,
	}

	json.NewEncoder(w).Encode(result)
}

// sanitizeText cleans up weird/garbled text and makes it safe for processing
func sanitizeText(text string) string {
	// Remove null bytes
	text = strings.ReplaceAll(text, "\x00", "")
	// Normalize line endings
	text = strings.ReplaceAll(text, "\r\n", "\n")
	text = strings.ReplaceAll(text, "\r", "\n")
	// Remove control characters (except newline, tab)
	var cleaned strings.Builder
	for _, r := range text {
		if r == '\n' || r == '\t' || r >= 32 {
			cleaned.WriteRune(r)
		}
	}
	return strings.TrimSpace(cleaned.String())
}

func sendError(w http.ResponseWriter, message string, code int) {
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(SummarizeResponse{
		Success: false,
		Message: message,
	})
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	cmd.Start()
}
