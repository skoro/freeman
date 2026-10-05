<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $code }} — {{ config('app.name', 'Freeman') }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen flex items-center justify-center">
    <div class="text-center px-6">
        <div class="text-8xl font-black text-gray-700 select-none">{{ $code }}</div>
        <h1 class="mt-4 text-2xl font-semibold text-gray-200">{{ $title }}</h1>
        <p class="mt-2 text-gray-400 max-w-sm mx-auto">{{ $message }}</p>
        <a href="{{ url('/') }}"
           class="mt-8 inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
            Go home
        </a>
    </div>
</body>
</html>
