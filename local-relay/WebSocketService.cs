using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using Fleck;

namespace SyncAudioRelay;

public class WebSocketService : IDisposable
{
    private WebSocketServer _server;
    private readonly List<IWebSocketConnection> _clients = new();
    private readonly object _lock = new();
    private AudioCaptureService _captureService;

    public WebSocketService(AudioCaptureService captureService)
    {
        _captureService = captureService;
        _captureService.OnAudioData += BroadcastAudio;
        _captureService.OnCaptureStarted += (name) => BroadcastJson("capture-status", new { status = "started", sessionName = name });
        _captureService.OnCaptureStopped += (name) => BroadcastJson("capture-status", new { status = "stopped", sessionName = name });
        _captureService.OnSourceClosed += (name) => BroadcastJson("source-closed", new { sessionName = name });
    }

    public void Start(int port = 9876)
    {
        _server = new WebSocketServer($"ws://0.0.0.0:{port}");
        _server.RestartAfterListenError = true;

        _server.Start(socket =>
        {
            socket.OnOpen = () =>
            {
                lock (_lock) _clients.Add(socket);
                Console.WriteLine($"Browser connected: {socket.ConnectionInfo.ClientIpAddress}");
                SendSessions(socket);
            };

            socket.OnClose = () =>
            {
                lock (_lock) _clients.Remove(socket);
                Console.WriteLine("Browser disconnected");
            };

            socket.OnMessage = message =>
            {
                try
                {
                    var json = JsonDocument.Parse(message);
                    var type = json.RootElement.GetProperty("type").GetString();

                    switch (type)
                    {
                        case "list-sessions":
                            SendSessions(socket);
                            break;

                        case "start-capture":
                            var sessionId = json.RootElement.GetProperty("sessionId").GetString();
                            _captureService.StartCapture(sessionId);
                            break;

                        case "stop-capture":
                            _captureService.StopCapture();
                            break;

                        case "get-status":
                            BroadcastJson("capture-status", new
                            {
                                status = _captureService.IsCapturing ? "started" : "stopped",
                                sessionName = _captureService.SelectedSessionName ?? "",
                            });
                            break;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"WS message error: {ex.Message}");
                }
            };

            socket.OnError = ex =>
            {
                Console.WriteLine($"WS error: {ex.Message}");
            };
        });

        Console.WriteLine($"WebSocket server running on ws://localhost:{port}");
    }

    private void SendSessions(IWebSocketConnection socket)
    {
        var sessions = _captureService.GetAudioSessions();
        var json = JsonSerializer.Serialize(new
        {
            type = "sessions",
            sessions = sessions.Select(s => new
            {
                id = s.Id,
                name = s.Name,
                processName = s.ProcessName,
                processId = s.ProcessId,
                isActive = s.IsActive,
            }),
            capturing = _captureService.IsCapturing,
            selectedSessionId = _captureService.SelectedSessionId,
        });
        try { socket.Send(json); } catch { }
    }

    private void BroadcastJson(string type, object data)
    {
        var json = JsonSerializer.Serialize(new { type, data });
        List<IWebSocketConnection> clients;
        lock (_lock) clients = new List<IWebSocketConnection>(_clients);

        foreach (var c in clients)
        {
            try { c.Send(json); } catch { }
        }
    }

    private void BroadcastAudio(float[] samples, int sampleRate)
    {
        var bytes = new byte[samples.Length * 4];
        Buffer.BlockCopy(samples, 0, bytes, 0, bytes.Length);

        List<IWebSocketConnection> clients;
        lock (_lock) clients = new List<IWebSocketConnection>(_clients);

        foreach (var c in clients)
        {
            try { c.Send(bytes); } catch { }
        }
    }

    public int ClientCount
    {
        get { lock (_lock) return _clients.Count; }
    }

    public void Stop()
    {
        _captureService.OnAudioData -= BroadcastAudio;

        List<IWebSocketConnection> clients;
        lock (_lock) clients = new List<IWebSocketConnection>(_clients);

        foreach (var c in clients)
        {
            try { c.Close(); } catch { }
        }

        _server?.Dispose();
        _server = null;
    }

    public void Dispose()
    {
        Stop();
    }
}
