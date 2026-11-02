using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace NewsCosmic
{
    static class Program
    {
        const string Title = "NEWS till Cosmic";

        [STAThread]
        static int Main(string[] args)
        {
            try
            {
                if (args.Length == 0 || args[0] == "--install")
                {
                    Install();
                    return 0;
                }
                if (args[0] == "--check") return Check(args);
                return Fill(args[0]);
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, Title, MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
        }

        static int Check(string[] args)
        {
            if (args.Length < 3) return 2;
            string error;
            string[] parts = Decode(args[1], out error);
            var report = new StringBuilder();
            if (parts == null)
            {
                report.Append("error=").Append(error);
                File.WriteAllText(args[2], report.ToString(), Encoding.UTF8);
                return 2;
            }
            int tabs = parts.Length > 0 ? parts.Length - 1 : 0;
            var values = new StringBuilder();
            for (int i = 0; i < parts.Length; i++)
            {
                if (parts[i].Length == 0) continue;
                if (values.Length > 0) values.Append("|");
                values.Append(parts[i]);
            }
            report.Append("tabs=").Append(tabs).Append("\n");
            report.Append("values=").Append(values.ToString());
            File.WriteAllText(args[2], report.ToString(), Encoding.UTF8);
            return 0;
        }

        static void Install()
        {
            string dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "NewsCosmic");
            Directory.CreateDirectory(dir);
            string dest = Path.Combine(dir, "NewsCosmic.exe");
            string source = typeof(Program).Assembly.Location;
            if (!string.Equals(Path.GetFullPath(source), Path.GetFullPath(dest), StringComparison.OrdinalIgnoreCase))
                File.Copy(source, dest, true);

            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\newss"))
            {
                key.SetValue("", "URL:NEWS till Cosmic");
                key.SetValue("URL Protocol", "");
            }
            using (RegistryKey command = Registry.CurrentUser.CreateSubKey(@"Software\Classes\newss\shell\open\command"))
            {
                command.SetValue("", "\"" + dest + "\" \"%1\"");
            }

            MessageBox.Show(
                "Appen \u00e4r installerad.\n\nG\u00e5 till newss.se, fyll i v\u00e4rdena och klicka Fyll i Cosmic.\nOm Edge fr\u00e5gar om appen f\u00e5r \u00f6ppnas: v\u00e4lj \u00d6ppna.",
                Title,
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
        }

        static int Fill(string raw)
        {
            string error;
            string[] parts = Decode(raw, out error);
            if (parts == null)
            {
                MessageBox.Show(
                    "V\u00e4rdena kunde inte l\u00e4sas. F\u00f6rs\u00f6k igen fr\u00e5n newss.se.",
                    Title,
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
                return 2;
            }

            string message =
                "Dessa v\u00e4rden skrivs in:\n" + Preview(parts) +
                "\n\nKlicka OK. Du har sedan 5 sekunder p\u00e5 dig att klicka i rutan Andningsfrekvens i Cosmic.\nR\u00f6r inte musen eller tangentbordet efter det.";
            if (MessageBox.Show(message, "Fyll i Cosmic", MessageBoxButtons.OKCancel, MessageBoxIcon.Information) != DialogResult.OK)
                return 0;

            Thread.Sleep(5000);
            for (int i = 0; i < parts.Length; i++)
            {
                string part = parts[i];
                for (int c = 0; c < part.Length; c++) SendChar(part[c]);
                if (IsAcvpu(part)) Thread.Sleep(250);
                if (i < parts.Length - 1)
                {
                    SendKeys.SendWait("{TAB}");
                    Thread.Sleep(120);
                }
            }
            MessageBox.Show(
                "Klart. Kontrollera v\u00e4rdena i Cosmic innan du sparar.",
                "Fyll i Cosmic",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
            return 0;
        }

        static string[] Decode(string raw, out string error)
        {
            error = null;
            if (string.IsNullOrEmpty(raw))
            {
                error = "empty";
                return null;
            }
            raw = raw.Trim().Trim('"');
            if (raw.StartsWith("newss:", StringComparison.OrdinalIgnoreCase))
                raw = raw.Substring("newss:".Length);
            while (raw.StartsWith("/")) raw = raw.Substring(1);
            if (raw.StartsWith("fill/", StringComparison.OrdinalIgnoreCase))
                raw = raw.Substring("fill/".Length);
            string text;
            try
            {
                text = Uri.UnescapeDataString(raw.Replace("+", "%2B"));
            }
            catch (UriFormatException)
            {
                error = "encoding";
                return null;
            }
            if (text.Length == 0 || text.Length > 200)
            {
                error = "length";
                return null;
            }
            for (int i = 0; i < text.Length; i++)
            {
                char c = text[i];
                bool ok = c == '\t' || c == ',' ||
                    (c >= '0' && c <= '9') ||
                    (c >= 'A' && c <= 'Z') ||
                    (c >= 'a' && c <= 'z');
                if (!ok)
                {
                    error = "char";
                    return null;
                }
            }
            return text.Split('\t');
        }

        static string Preview(string[] parts)
        {
            var values = new StringBuilder();
            for (int i = 0; i < parts.Length; i++)
            {
                if (parts[i].Length == 0) continue;
                if (values.Length > 0) values.Append("   ");
                values.Append(parts[i]);
            }
            return values.ToString();
        }

        static bool IsAcvpu(string part)
        {
            return part == "Alert" || part == "Confusion" || part == "Voice" || part == "Pain" || part == "Unresponsive";
        }

        static void SendChar(char c)
        {
            string key = c.ToString();
            if ("+^%~(){}[]".IndexOf(c) >= 0) key = "{" + c + "}";
            SendKeys.SendWait(key);
            Thread.Sleep(40);
        }
    }
}
