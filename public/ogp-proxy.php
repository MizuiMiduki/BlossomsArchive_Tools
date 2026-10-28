<?php

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(array('ok' => false, 'error' => 'Method not allowed'));
    exit;
}

$rawUrl = (isset($_GET['url']) && is_string($_GET['url'])) ? trim($_GET['url']) : '';
if ($rawUrl === '') {
    http_response_code(400);
    echo json_encode(array('ok' => false, 'error' => 'URL parameter is required'));
    exit;
}

/**
 * Validate URL and prevent SSRF to private/reserved IP ranges.
 */
function isSafeUrl($url)
{
    $parsed = @parse_url($url);
    if (!is_array($parsed)) {
        return false;
    }

    $scheme = isset($parsed['scheme']) ? strtolower((string)$parsed['scheme']) : '';
    if ($scheme !== 'http' && $scheme !== 'https') {
        return false;
    }

    $host = isset($parsed['host']) ? strtolower((string)$parsed['host']) : '';
    if ($host === '' || $host === 'localhost') {
        return false;
    }
    if (substr($host, -6) === '.local' || substr($host, -9) === '.internal') {
        return false;
    }

    $port = isset($parsed['port']) ? (int)$parsed['port'] : ($scheme === 'https' ? 443 : 80);
    if ($port !== 80 && $port !== 443 && $port !== 8080 && $port !== 8443) {
        return false;
    }

    if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
        return filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
    }

    $ips = @gethostbynamel($host);
    if (is_array($ips) && count($ips) > 0) {
        foreach ($ips as $ip) {
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Resolve redirect Location header against current URL.
 */
function resolveRedirectUrl($baseUrl, $location)
{
    $location = trim((string)$location);
    if (preg_match('/^https?:\/\//i', $location)) {
        return $location;
    }
    $parsed = @parse_url($baseUrl);
    if (!is_array($parsed) || !isset($parsed['scheme'], $parsed['host'])) {
        return '';
    }
    $scheme = $parsed['scheme'];
    $host = $parsed['host'];
    $port = isset($parsed['port']) ? ':' . $parsed['port'] : '';
    $origin = $scheme . '://' . $host . $port;

    if (strpos($location, '//') === 0) {
        return $scheme . ':' . $location;
    }
    if (strpos($location, '/') === 0) {
        return $origin . $location;
    }

    $path = isset($parsed['path']) ? $parsed['path'] : '/';
    $dir = preg_replace('#/[^/]*$#', '/', $path);
    return $origin . $dir . $location;
}

function executeCurlRequest($url, $userAgent, $verifySsl = true)
{
    $ch = curl_init($url);
    $responseHeaders = array();
    $opts = array(
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_ENCODING => '',
        CURLOPT_USERAGENT => $userAgent,
        CURLOPT_SSL_VERIFYPEER => $verifySsl,
        CURLOPT_SSL_VERIFYHOST => $verifySsl ? 2 : 0,
        CURLOPT_HTTPHEADER => array(
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language: ja,en-US;q=0.9,en;q=0.8',
            'Cache-Control: no-cache',
        ),
        CURLOPT_HEADERFUNCTION => function ($curl, $headerLine) use (&$responseHeaders) {
            $len = strlen($headerLine);
            $parts = explode(':', $headerLine, 2);
            if (count($parts) === 2) {
                $name = strtolower(trim($parts[0]));
                $value = trim($parts[1]);
                $responseHeaders[$name] = $value;
            }
            return $len;
        },
    );
    if (defined('CURLPROTO_HTTP') && defined('CURLPROTO_HTTPS')) {
        $opts[CURLOPT_PROTOCOLS] = CURLPROTO_HTTP | CURLPROTO_HTTPS;
    }
    if (!$verifySsl && defined('CURL_HTTP_VERSION_1_1')) {
        $opts[CURLOPT_HTTP_VERSION] = CURL_HTTP_VERSION_1_1;
    }
    curl_setopt_array($ch, $opts);

    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    return array(
        'body' => $body,
        'status' => $status,
        'error' => $err,
        'headers' => $responseHeaders,
    );
}

function fetchUrlWithRedirects($initialUrl, $userAgent, $maxRedirects = 5)
{
    $currentUrl = $initialUrl;

    for ($i = 0; $i <= $maxRedirects; $i++) {
        if (!isSafeUrl($currentUrl)) {
            return array('ok' => false, 'status' => 403, 'error' => 'Invalid or restricted target URL');
        }

        if (function_exists('curl_init')) {
            $res = executeCurlRequest($currentUrl, $userAgent, true);
            if ($res['body'] === false) {
                $res = executeCurlRequest($currentUrl, $userAgent, false);
            }

            if ($res['body'] !== false) {
                $status = $res['status'];
                $responseHeaders = $res['headers'];
                if (in_array($status, array(301, 302, 303, 307, 308), true) && !empty($responseHeaders['location'])) {
                    $nextUrl = resolveRedirectUrl($currentUrl, $responseHeaders['location']);
                    if ($nextUrl === '') {
                        return array('ok' => false, 'status' => 400, 'error' => 'Invalid redirect location');
                    }
                    $currentUrl = $nextUrl;
                    continue;
                }

                return array(
                    'ok' => $status >= 200 && $status < 400,
                    'status' => $status,
                    'body' => (string)$res['body'],
                    'contentType' => isset($responseHeaders['content-type']) ? $responseHeaders['content-type'] : '',
                    'finalUrl' => $currentUrl,
                );
            }
            $err = $res['error'];
        }

        // Stream fallback if cURL is unavailable or failed
        $context = stream_context_create(array(
            'http' => array(
                'method' => 'GET',
                'timeout' => 10,
                'follow_location' => 1,
                'max_redirects' => 5,
                'ignore_errors' => true,
                'header' => "User-Agent: {$userAgent}\r\nAccept: text/html,application/xhtml+xml\r\nAccept-Language: ja,en;q=0.8\r\n",
            ),
            'ssl' => array(
                'verify_peer' => false,
                'verify_peer_name' => false,
            ),
        ));
        $body = @file_get_contents($currentUrl, false, $context);
        if ($body === false) {
            return array('ok' => false, 'status' => 502, 'error' => isset($err) && $err ? $err : 'Failed to fetch target URL');
        }
        return array(
            'ok' => true,
            'status' => 200,
            'body' => (string)$body,
            'contentType' => '',
            'finalUrl' => $currentUrl,
        );
    }

    return array('ok' => false, 'status' => 310, 'error' => 'Too many redirects');
}

$browserUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
$botUa = 'Mozilla/5.0 (compatible; Twitterbot/1.0)';

$result = fetchUrlWithRedirects($rawUrl, $browserUa);
$bodyLower = isset($result['body']) ? strtolower((string)$result['body']) : '';
if (!$result['ok'] || strpos($bodyLower, 'og:') === false) {
    $botResult = fetchUrlWithRedirects($rawUrl, $botUa);
    if ($botResult['ok'] && !empty($botResult['body'])) {
        $result = $botResult;
    }
}

if (!$result['ok'] || empty($result['body'])) {
    http_response_code(502);
    echo json_encode(array(
        'ok' => false,
        'status' => isset($result['status']) ? $result['status'] : 502,
        'error' => isset($result['error']) ? $result['error'] : 'Failed to retrieve HTML',
    ));
    exit;
}

$html = (string)$result['body'];

if (strlen($html) > 524288) {
    $headEndPos = stripos($html, '</head>');
    if ($headEndPos !== false) {
        $html = substr($html, 0, $headEndPos + 7) . '<body></body></html>';
    } else {
        $html = substr($html, 0, 524288);
    }
}

if (function_exists('mb_convert_encoding')) {
    $contentType = isset($result['contentType']) ? $result['contentType'] : '';
    $charset = '';
    if (preg_match('/charset=([a-zA-Z0-9_-]+)/i', $contentType, $m)) {
        $charset = strtoupper($m[1]);
    } elseif (preg_match('/<meta[^>]+charset=["\']?([a-zA-Z0-9_-]+)/i', substr($html, 0, 8192), $m)) {
        $charset = strtoupper($m[1]);
    }

    if ($charset !== '' && $charset !== 'UTF-8' && $charset !== 'UTF8') {
        $converted = @mb_convert_encoding($html, 'UTF-8', $charset);
        if (is_string($converted) && $converted !== '') {
            $html = $converted;
        }
    } else {
        $html = @mb_convert_encoding($html, 'UTF-8', 'UTF-8');
    }
}

$jsonFlags = defined('JSON_UNESCAPED_UNICODE') ? JSON_UNESCAPED_UNICODE : 0;
if (defined('JSON_INVALID_UTF8_SUBSTITUTE')) {
    $jsonFlags |= JSON_INVALID_UTF8_SUBSTITUTE;
}

echo json_encode(array(
    'ok' => true,
    'finalUrl' => isset($result['finalUrl']) ? $result['finalUrl'] : $rawUrl,
    'html' => $html,
), $jsonFlags);
