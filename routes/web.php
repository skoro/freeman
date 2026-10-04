<?php

use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ChangePasswordController;
use App\Http\Controllers\CollectionController;
use App\Http\Controllers\EnvironmentController;
use App\Http\Controllers\FolderController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\RunnerController;
use App\Http\Controllers\SavedRequestController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => redirect()->route('workspace'));

// Guest routes
Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login'])->name('login.attempt');

    // Password reset
    Route::get('/forgot-password', [PasswordResetController::class, 'showForgotForm'])->name('password.request');
    Route::post('/forgot-password', [PasswordResetController::class, 'sendResetLink'])->name('password.email');
    Route::get('/reset-password/{token}', [PasswordResetController::class, 'showResetForm'])->name('password.reset');
    Route::post('/reset-password', [PasswordResetController::class, 'resetPassword'])->name('password.update');
});

// Authenticated routes (password change allowed even when must_change_password=true)
Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
    Route::get('/change-password', [ChangePasswordController::class, 'show'])->name('password.change');
    Route::post('/change-password', [ChangePasswordController::class, 'update'])->name('password.change.update');
});

// Authenticated + password change enforced
Route::middleware(['auth', 'must.change.password'])->group(function () {
    Route::view('/workspace', 'workspace')->name('workspace');

    // Request runner (JSON) — rate limited to 60 requests/min per user
    Route::post('/run', [RunnerController::class, 'run'])->name('run')->middleware('throttle:run');

    // Collections (JSON)
    Route::get('/collections', [CollectionController::class, 'index'])->name('collections.index');
    Route::post('/collections', [CollectionController::class, 'store'])->name('collections.store');
    Route::post('/collections/import', [CollectionController::class, 'import'])->name('collections.import');
    Route::get('/collections/{collection}/export', [CollectionController::class, 'export'])->name('collections.export');
    Route::get('/collections/{collection}/variables', [CollectionController::class, 'showVariables'])->name('collections.variables.show');
    Route::patch('/collections/{collection}/variables', [CollectionController::class, 'updateVariables'])->name('collections.variables.update');
    Route::patch('/collections/{collection}', [CollectionController::class, 'update'])->name('collections.update');
    Route::delete('/collections/{collection}', [CollectionController::class, 'destroy'])->name('collections.destroy');

    // Folders (JSON)
    Route::post('/collections/{collection}/folders', [FolderController::class, 'store'])->name('folders.store');
    Route::patch('/collections/{collection}/folders/{folder}', [FolderController::class, 'update'])->name('folders.update');
    Route::delete('/collections/{collection}/folders/{folder}', [FolderController::class, 'destroy'])->name('folders.destroy');

    // Environments (JSON)
    Route::get('/environments', [EnvironmentController::class, 'index'])->name('environments.index');
    Route::post('/environments', [EnvironmentController::class, 'store'])->name('environments.store');
    Route::patch('/environments/{id}', [EnvironmentController::class, 'update'])->name('environments.update');
    Route::delete('/environments/{id}', [EnvironmentController::class, 'destroy'])->name('environments.destroy');
    Route::post('/environments/{id}/activate', [EnvironmentController::class, 'activate'])->name('environments.activate');
    Route::post('/environments/deactivate', [EnvironmentController::class, 'deactivate'])->name('environments.deactivate');

    // Requests (JSON)
    Route::get('/requests/{request}', [SavedRequestController::class, 'show'])->name('requests.show');
    Route::post('/requests', [SavedRequestController::class, 'store'])->name('requests.store');
    Route::patch('/requests/{savedRequest}', [SavedRequestController::class, 'update'])->name('requests.update');
    Route::delete('/requests/{savedRequest}', [SavedRequestController::class, 'destroy'])->name('requests.destroy');
    Route::post('/requests/{savedRequest}/duplicate', [SavedRequestController::class, 'duplicate'])->name('requests.duplicate');
    Route::get('/collections/{collection}/requests', [SavedRequestController::class, 'indexForCollection'])->name('requests.for-collection');
    Route::get('/collections/{collection}/folders/{folder}/requests', [SavedRequestController::class, 'indexForFolder'])->name('requests.for-folder');
});

// Super admin only
Route::middleware(['auth', 'must.change.password', 'super.admin'])
    ->prefix('admin')
    ->name('admin.')
    ->group(function () {
        Route::get('/users', [AdminUserController::class, 'index'])->name('users.index');
        Route::post('/users', [AdminUserController::class, 'store'])->name('users.store');
        Route::patch('/users/{id}', [AdminUserController::class, 'update'])->name('users.update');
        Route::delete('/users/{id}', [AdminUserController::class, 'destroy'])->name('users.destroy');
    });
