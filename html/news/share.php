<?php
// Dynamic Open Graph share page for social crawlers
// Usage: /html/news/news-detail.html?id=<docId>
// This script is targeted by server rewrite rules for social bot user agents

header('Content-Type: text/html; charset=utf-8');

$id = isset($_GET['id']) ? preg_replace('/[^A-Za-z0-9_\-]/', '', $_GET['id']) : '';
$projectId = 'bcvworld-cc40e';
$defaultImage = '/assets/images/logo.png';
$canonical = 'https://bcvworld.com/html/news/news-detail.html' . ($id ? ('?id=' . $id) : '');

function fetchFirestoreDocument($projectId, $collection, $id) {
  if (!$id) return null;
  $url = 'https://firestore.googleapis.com/v1/projects/' . $projectId . '/databases/(default)/documents/' . $collection . '/' . $id;
  $ctx = stream_context_create(['http' => ['timeout' => 3]]);
  $json = @file_get_contents($url, false, $ctx);
  if (!$json) return null;
  $data = json_decode($json, true);
  if (!is_array($data)) return null;
  return $data;
}

function fieldString($fields, $key) {
  if (!isset($fields[$key])) return '';
  $v = $fields[$key];
  foreach (['stringValue','integerValue','doubleValue','booleanValue'] as $type) {
    if (isset($v[$type])) return trim(strval($v[$type]));
  }
  return '';
}

function storageUrlFromPath($bucket, $path) {
  if (!$path) return '';
  $encoded = str_replace('%2F', '/', rawurlencode($path));
  return 'https://firebasestorage.googleapis.com/v0/b/' . $bucket . '/o/' . $encoded . '?alt=media';
}

$doc = fetchFirestoreDocument($projectId, 'news', $id);
$title = 'News Detail - BCVWorld';
$desc = 'Read the latest story on BCVWorld.';
$image = $defaultImage;
if ($doc && isset($doc['fields'])) {
  $f = $doc['fields'];
  $titleCandidate = fieldString($f, 'title');
  $descCandidate = fieldString($f, 'excerpt');
  if (!$descCandidate) $descCandidate = fieldString($f, 'description');
  $imageUrl = fieldString($f, 'imageUrl');
  if (!$imageUrl) $imageUrl = fieldString($f, 'featuredImageUrl');
  if (!$imageUrl) $imageUrl = fieldString($f, 'image');
  if (!$imageUrl) {
    $storagePath = fieldString($f, 'imageStoragePath');
    if (!$storagePath) $storagePath = fieldString($f, 'storagePath');
    if ($storagePath) {
      // Note: bucket name derived from project id convention used in firebase-config
      $bucket = $projectId . '.firebasestorage.app';
      $imageUrl = storageUrlFromPath($bucket, $storagePath);
    }
  }
  if ($titleCandidate) $title = $titleCandidate;
  if ($descCandidate) $desc = mb_substr($descCandidate, 0, 160);
  if ($imageUrl) $image = $imageUrl;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title><?php echo htmlspecialchars($title); ?></title>
  <link rel="canonical" href="<?php echo htmlspecialchars($canonical); ?>" />

  <meta property="og:title" content="<?php echo htmlspecialchars($title); ?>" />
  <meta property="og:description" content="<?php echo htmlspecialchars($desc); ?>" />
  <meta property="og:image" content="<?php echo htmlspecialchars($image); ?>" />
  <meta property="og:url" content="<?php echo htmlspecialchars($canonical); ?>" />
  <meta property="og:type" content="article" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="<?php echo htmlspecialchars($title); ?>" />
  <meta name="twitter:description" content="<?php echo htmlspecialchars($desc); ?>" />
  <meta name="twitter:image" content="<?php echo htmlspecialchars($image); ?>" />
  <meta name="robots" content="noindex, follow" />
</head>
<body>
  <noscript>
    <p><a href="<?php echo htmlspecialchars($canonical); ?>">View article</a></p>
  </noscript>
  <script>
    // Redirect users to the actual dynamic page
    location.replace("<?php echo htmlspecialchars($canonical); ?>");
  </script>
</body>
</html>

