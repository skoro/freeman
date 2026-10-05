<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ config('app.name', 'Freeman') }}@hasSection('title') — @yield('title')@endif</title>
    <link rel="icon" type="image/png" href="{{ asset('images/Freeman-logo.png') }}">
    <script src="{{ asset('js/freeman-utils.js') }}"></script>
    <script src="{{ asset('js/freeman-store.js') }}"></script>
    <script src="{{ asset('js/freeman-shell.js') }}"></script>
    <script src="{{ asset('js/freeman-sidebar.js') }}"></script>
    <script src="{{ asset('js/freeman-request-builder.js') }}"></script>
    <script src="{{ asset('js/freeman-modals.js') }}"></script>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="antialiased overflow-hidden">
    @yield('content')
</body>
</html>
