package com.cleanexpense.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** Uses the existing HTTPS API; no database or OpenAI secrets are packaged in the app. */
public class MainActivity extends Activity {
    private static final String HOST = "cleanexpense.vercel.app";
    private static final String BASE = "https://" + HOST;
    private static final int PICK_STATEMENT = 101, SAVE_CSV = 102;
    private WebView web;
    private ProgressBar progress;
    private LinearLayout errorPanel;
    private ValueCallback<Uri[]> fileCallback;
    private Uri sharedPdf;
    private byte[] exportData;
    private boolean requestImport;
    private int importRetries;

    private boolean trusted(String url) {
        if (url == null) return false;
        Uri uri = Uri.parse(url);
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && (uri.getPort() == -1 || uri.getPort() == 443);
    }
    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }
    private void toast(String message) { Toast.makeText(this, message, Toast.LENGTH_LONG).show(); }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        root.addView(progress, new LinearLayout.LayoutParams(-1, dp(3)));
        errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setGravity(Gravity.CENTER);
        errorPanel.setPadding(dp(24), dp(20), dp(24), dp(20));
        TextView error = new TextView(this);
        error.setText("Unable to connect to CleanExpense.\nCheck your internet connection and try again.\n\nYour saved transactions remain in the remote database.");
        error.setTextSize(16);
        error.setGravity(Gravity.CENTER);
        errorPanel.addView(error);
        Button retry = new Button(this);
        retry.setText(R.string.try_again);
        retry.setOnClickListener(v -> { errorPanel.setVisibility(View.GONE); web.setVisibility(View.VISIBLE); web.loadUrl(BASE + "/"); });
        errorPanel.addView(retry);
        root.addView(errorPanel, new LinearLayout.LayoutParams(-1, 0, 1));
        errorPanel.setVisibility(View.GONE);
        web = new WebView(this);
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSafeBrowsingEnabled(true);
        settings.setUserAgentString(settings.getUserAgentString() + " CleanExpenseAndroid/1.0");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.addJavascriptInterface(new ExportBridge(), "CleanExpenseExport");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (trusted(url)) return false;
                if (request.isForMainFrame() && "https".equals(request.getUrl().getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl())); } catch (ActivityNotFoundException ignored) { toast("No browser is available."); }
                }
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) { progress.setVisibility(View.VISIBLE); }
            @Override public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                CookieManager.getInstance().flush();
                if (!trusted(url)) return;
                installExportHandler();
                if (requestImport) openWebImport();
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showNetworkError();
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 500) showNetworkError();
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) { handler.cancel(); showNetworkError(); }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int percent) { progress.setProgress(percent); }
            @Override public boolean onJsConfirm(WebView view, String url, String message, android.webkit.JsResult result) {
                if (!trusted(url)) { result.cancel(); return true; }
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("Continue", (d,w) -> result.confirm()).setNegativeButton("Cancel", (d,w) -> result.cancel()).setOnCancelListener(d -> result.cancel()).show();
                return true;
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (!trusted(view.getUrl())) { callback.onReceiveValue(null); return true; }
                requestImport = false;
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                if (sharedPdf != null) {
                    Uri uri = sharedPdf; sharedPdf = null;
                    finishFileChoice(validStatement(uri) ? uri : null);
                    return true;
                }
                Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("*/*");
                pick.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/pdf", "text/csv", "text/comma-separated-values", "text/plain", "application/vnd.ms-excel", "application/octet-stream"});
                pick.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { startActivityForResult(pick, PICK_STATEMENT); } catch (ActivityNotFoundException e) { finishFileChoice(null); toast("No file picker is available."); }
                return true;
            }
        });
        LinearLayout navigation = new LinearLayout(this);
        navigation.setPadding(dp(4), dp(3), dp(4), dp(3));
        addNav(navigation, "Overview", "/");
        addNav(navigation, "Timeline", "/expenses");
        addNav(navigation, "Forecast", "/forecast");
        Button upload = navButton("Import PDF");
        upload.setOnClickListener(v -> { requestImport = true; importRetries = 0; navigate("/"); });
        navigation.addView(upload, new LinearLayout.LayoutParams(0, dp(54), 1));
        root.addView(navigation);
        setContentView(root);
        acceptSharedPdf(getIntent());
        if (state == null || web.restoreState(state) == null) web.loadUrl(BASE + "/");
    }
    private void showNetworkError() { progress.setVisibility(View.GONE); web.setVisibility(View.GONE); errorPanel.setVisibility(View.VISIBLE); }
    private Button navButton(String label) { Button b = new Button(this); b.setText(label); b.setTextSize(11); b.setAllCaps(false); b.setMinWidth(0); b.setPadding(dp(3),0,dp(3),0); b.setTextColor(Color.rgb(113,85,214)); return b; }
    private void addNav(LinearLayout row, String label, String path) { Button b = navButton(label); b.setOnClickListener(v -> navigate(path)); row.addView(b, new LinearLayout.LayoutParams(0,dp(54),1)); }
    private void navigate(String path) {
        web.setVisibility(View.VISIBLE); errorPanel.setVisibility(View.GONE);
        // Prefer Next.js links so navigation preserves the loaded workspace and unsaved edits.
        if (trusted(web.getUrl())) {
            String script = "(function(){var a=Array.from(document.querySelectorAll('a')).find(a=>a.getAttribute('href')===" + org.json.JSONObject.quote(path) + ");if(a){a.click();return true;}return false;})()";
            web.evaluateJavascript(script, value -> { if (!"true".equals(value)) web.loadUrl(BASE+path); else if (requestImport) openWebImport(); });
        } else web.loadUrl(BASE + path);
    }
    private void openWebImport() {
        if (!requestImport || web == null) return;
        if (importRetries++ >= 60) { requestImport=false; toast("Open Overview, sign in, then choose Import statement."); return; }
        web.evaluateJavascript("(function(){if(location.pathname!=='/')return false;var input=document.querySelector('input[type=file]');var b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Import statement');if(input&&b&&!b.disabled){input.click();return true;}return false;})()", value -> { if (!"true".equals(value) && requestImport) web.postDelayed(this::openWebImport,500); });
    }
    private boolean validStatement(Uri uri) {
        if (uri == null || !"content".equals(uri.getScheme())) { toast("Choose a PDF or CSV from the Android file picker."); return false; }
        String name=""; long size=-1;
        try (Cursor cursor=getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE},null,null,null)) {
            if(cursor!=null&&cursor.moveToFirst()){name=cursor.getString(0);if(!cursor.isNull(1))size=cursor.getLong(1);}
            if (size>20_000_000) { toast("Choose a statement smaller than 20 MB.");return false; }
            String lower=name==null?"":name.toLowerCase(Locale.ROOT);
            if(lower.endsWith(".pdf")) { try(InputStream in=getContentResolver().openInputStream(uri)){byte[] magic=new byte[5];if(in==null||in.read(magic)!=5||!"%PDF-".equals(new String(magic,StandardCharsets.US_ASCII))){toast("This file is not a valid PDF.");return false;}} }
            else if(!lower.endsWith(".csv")){toast("Select a .pdf or .csv bank statement.");return false;}
            return true;
        } catch(Exception e){toast("The selected file could not be read. Try saving it in Downloads first.");return false;}
    }
    private void finishFileChoice(Uri uri) { if(fileCallback!=null){fileCallback.onReceiveValue(uri==null?null:new Uri[]{uri});fileCallback=null;} }
    private void acceptSharedPdf(Intent intent) {
        if(Intent.ACTION_SEND.equals(intent.getAction())&&"application/pdf".equals(intent.getType())){
            Uri uri=intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if(validStatement(uri)){sharedPdf=uri;requestImport=true;importRetries=0;}
        }
    }
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);acceptSharedPdf(intent);if(sharedPdf!=null)navigate("/");}
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==PICK_STATEMENT){Uri uri=result==RESULT_OK&&data!=null?data.getData():null;finishFileChoice(uri!=null&&validStatement(uri)?uri:null);}
        if(request==SAVE_CSV){byte[] bytes=exportData;exportData=null;if(result==RESULT_OK&&data!=null&&data.getData()!=null&&bytes!=null){Uri uri=data.getData();new Thread(()->{try(OutputStream out=getContentResolver().openOutputStream(uri,"w")){if(out==null)throw new java.io.IOException();out.write(bytes);runOnUiThread(()->toast("CSV saved."));}catch(Exception e){runOnUiThread(()->toast("Could not save the CSV. Try again."));}}).start();}}
    }
    private void installExportHandler(){
        web.evaluateJavascript("(function(){if(window.__cleanExpenseExport)return;window.__cleanExpenseExport=true;var original=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:')){fetch(this.href).then(r=>r.blob()).then(blob=>{if(blob.size>8000000)throw Error();var reader=new FileReader();reader.onload=()=>CleanExpenseExport.saveCsv(String(reader.result).split(',')[1]);reader.readAsDataURL(blob);}).catch(()=>alert('Could not export CSV. Please try again.'));return;}return original.call(this);};})()",null);
    }
    public final class ExportBridge {
        @JavascriptInterface public void saveCsv(String base64){
            if(base64==null||base64.length()>11_000_000)return;
            runOnUiThread(()->{if(!trusted(web.getUrl())||exportData!=null)return;try{exportData=Base64.decode(base64,Base64.DEFAULT);Intent save=new Intent(Intent.ACTION_CREATE_DOCUMENT);save.addCategory(Intent.CATEGORY_OPENABLE);save.setType("text/csv");save.putExtra(Intent.EXTRA_TITLE,"cleanexpense-transactions.csv");startActivityForResult(save,SAVE_CSV);}catch(Exception e){exportData=null;toast("CSV export is unavailable.");}});
        }
    }
    @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
    @Override protected void onSaveInstanceState(Bundle state){web.saveState(state);super.onSaveInstanceState(state);}
    @Override protected void onPause(){super.onPause();web.onPause();CookieManager.getInstance().flush();}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
    @Override protected void onDestroy(){finishFileChoice(null);web.removeJavascriptInterface("CleanExpenseExport");web.destroy();super.onDestroy();}
}
