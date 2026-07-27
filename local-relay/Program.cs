using System;
using System.Drawing;
using System.Windows.Forms;

namespace SyncAudioRelay;

static class Program
{
    private static AudioCaptureService _captureService;
    private static WebSocketService _wsService;
    private static NotifyIcon _trayIcon;
    private static ContextMenuStrip _menu;
    private static ToolStripMenuItem _captureItem;

    [STAThread]
    static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        _captureService = new AudioCaptureService();
        _wsService = new WebSocketService(_captureService);

        SetupTray();
        _wsService.Start(9876);

        Application.Run();
    }

    static void SetupTray()
    {
        _trayIcon = new NotifyIcon
        {
            Icon = CreateIcon(),
            Text = "Sync Audio Relay",
            Visible = true,
        };

        _menu = new ContextMenuStrip();

        var statusItem = new ToolStripMenuItem("📡 Status: Idle");
        statusItem.Name = "statusItem";
        statusItem.Enabled = false;
        _menu.Items.Add(statusItem);

        _menu.Items.Add(new ToolStripSeparator());

        _captureItem = new ToolStripMenuItem("▶ Start Capture");
        _captureItem.Click += OnCaptureClick;
        _menu.Items.Add(_captureItem);

        var browserItem = new ToolStripMenuItem("🌐 Open Browser", null, (s, e) =>
        {
            try { System.Diagnostics.Process.Start("http://localhost:5173/sync-music-room"); } catch { }
        });
        _menu.Items.Add(browserItem);

        _menu.Items.Add(new ToolStripSeparator());
        _menu.Items.Add("Exit", null, (s, e) => Exit());

        _trayIcon.ContextMenuStrip = _menu;
        _trayIcon.DoubleClick += (s, e) => OnCaptureClick(null, null);
    }

    static void OnCaptureClick(object sender, EventArgs e)
    {
        if (_captureService.IsCapturing)
        {
            _captureService.StopCapture();
            UpdateStatus("Idle");
            _captureItem.Text = "▶ Start Capture";
        }
        else
        {
            var sessions = _captureService.GetAudioSessions();
            if (sessions.Count == 0)
            {
                UpdateStatus("No audio sources found");
                return;
            }

            var pickMenu = new ContextMenuStrip();
            foreach (var session in sessions)
            {
                var capturedSession = session;
                pickMenu.Items.Add($"🎵 {capturedSession.Name}", null, (pickSender, pickArgs) =>
                {
                    _captureService.StartCapture(capturedSession.Id);
                    UpdateStatus($"Capturing: {capturedSession.Name}");
                    _captureItem.Text = "⏹ Stop Capture";
                });
            }
            pickMenu.Items.Add(new ToolStripSeparator());
            pickMenu.Items.Add("Cancel");
            pickMenu.Show(Cursor.Position);
        }
    }

    static void UpdateStatus(string text)
    {
        var item = _menu.Items["statusItem"] as ToolStripMenuItem;
        if (item != null) item.Text = $"📡 Status: {text}";
        _trayIcon.Text = $"Sync Audio Relay - {text}";
    }

    static void Exit()
    {
        _captureService?.Dispose();
        _wsService?.Dispose();
        _trayIcon?.Dispose();
        Application.Exit();
    }

    static Icon CreateIcon()
    {
        using var bmp = new Bitmap(16, 16);
        using var g = Graphics.FromImage(bmp);
        g.Clear(Color.Transparent);
        using var brush = new SolidBrush(Color.FromArgb(108, 99, 255));
        g.FillEllipse(brush, 2, 2, 12, 12);
        using var pen = new Pen(Color.White, 2);
        g.DrawLine(pen, 6, 5, 6, 11);
        g.DrawLine(pen, 6, 8, 10, 5);
        g.DrawLine(pen, 6, 8, 10, 11);
        return Icon.FromHandle(bmp.GetHicon());
    }
}
