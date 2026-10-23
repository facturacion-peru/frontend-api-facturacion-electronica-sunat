package io.github.facturacion_peru.app.printer;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothClass;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Impresora térmica por Bluetooth clásico (spec 015, A-75): lista los equipos
 * ya emparejados y envía bytes ESC/POS por el perfil de puerto serie (SPP).
 * Una conexión por impresión: abrir, escribir y cerrar. Los bytes los arma la
 * API; aquí no se interpreta nada.
 *
 * Solo usa BLUETOOTH_CONNECT (Android 12+). En Android 11 o menos bastan los
 * permisos del manifiesto, que no piden diálogo. No busca equipos ni pide la
 * ubicación: se emparejan en los ajustes de Android (A-78).
 */
@CapacitorPlugin(
    name = "BluetoothPrinter",
    permissions = { @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = BluetoothPrinterPlugin.PERMISSION) }
)
public class BluetoothPrinterPlugin extends Plugin {

    static final String PERMISSION = "bluetooth";

    /** Perfil de puerto serie (SPP), el de casi todas las impresoras térmicas. */
    private static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    /** connect() de Android puede bloquear unos 12 s: CE-004 pide avisar antes de 10 s. */
    private static final long CONNECT_TIMEOUT_MS = 8000;

    private static final long WRITE_TIMEOUT_MS = 15000;

    /** Bloques pequeños para no saturar el búfer de las impresoras baratas. */
    private static final int CHUNK_BYTES = 512;

    /** Pausa antes de cerrar: algunas impresoras pierden el final si se corta enseguida. */
    private static final long DRAIN_MS = 300;

    /** Un solo hilo: las impresiones van de a una. */
    private final ExecutorService printer = Executors.newSingleThreadExecutor();

    private final ScheduledExecutorService watchdog = Executors.newSingleThreadScheduledExecutor();

    @Override
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            call.resolve(grantedResult());
            return;
        }
        super.checkPermissions(call);
    }

    @Override
    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            call.resolve(grantedResult());
            return;
        }
        super.requestPermissions(call);
    }

    @PluginMethod
    public void status(PluginCall call) {
        BluetoothAdapter adapter = adapter();
        JSObject result = new JSObject();
        result.put("supported", adapter != null);
        result.put("enabled", adapter != null && adapter.isEnabled());
        call.resolve(result);
    }

    @PluginMethod
    @SuppressLint("MissingPermission") // comprobado en ready()
    public void listPaired(PluginCall call) {
        BluetoothAdapter adapter = ready(call);
        if (adapter == null) {
            return;
        }

        try {
            // Se muestran todos (muchas impresoras se anuncian con clases genéricas), primero las de «imagen».
            List<JSObject> printers = new ArrayList<>();
            List<JSObject> others = new ArrayList<>();
            for (BluetoothDevice device : adapter.getBondedDevices()) {
                JSObject item = new JSObject();
                item.put("name", device.getName() != null ? device.getName() : device.getAddress());
                item.put("address", device.getAddress());
                BluetoothClass type = device.getBluetoothClass();
                boolean imaging = type != null && type.getMajorDeviceClass() == BluetoothClass.Device.Major.IMAGING;
                (imaging ? printers : others).add(item);
            }
            JSArray devices = new JSArray();
            for (JSObject item : printers) {
                devices.put(item);
            }
            for (JSObject item : others) {
                devices.put(item);
            }
            JSObject result = new JSObject();
            result.put("devices", devices);
            call.resolve(result);
        } catch (SecurityException e) {
            call.reject("Sin permiso de Bluetooth.", "permission_denied");
        }
    }

    @PluginMethod
    @SuppressLint("MissingPermission") // comprobado en ready()
    public void print(PluginCall call) {
        String address = call.getString("address");
        String data = call.getString("data");
        if (address == null || !BluetoothAdapter.checkBluetoothAddress(address) || data == null) {
            call.reject("Faltan la impresora o los datos.", "invalid");
            return;
        }

        BluetoothAdapter adapter = ready(call);
        if (adapter == null) {
            return;
        }

        final byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Datos de impresión no válidos.", "invalid");
            return;
        }

        BluetoothDevice device = adapter.getRemoteDevice(address);
        try {
            if (device.getBondState() != BluetoothDevice.BOND_BONDED) {
                call.reject("La impresora ya no está emparejada.", "not_paired");
                return;
            }
        } catch (SecurityException e) {
            call.reject("Sin permiso de Bluetooth.", "permission_denied");
            return;
        }

        printer.execute(() -> send(call, device, bytes));
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void requestEnable(PluginCall call) {
        if (adapter() == null) {
            call.reject("Este teléfono no tiene Bluetooth.", "unsupported");
            return;
        }
        if (!hasPermission()) {
            call.reject("Sin permiso de Bluetooth.", "permission_denied");
            return;
        }
        startActivityForResult(call, new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), "enableResult");
    }

    @ActivityCallback
    private void enableResult(PluginCall call, ActivityResult result) {
        BluetoothAdapter adapter = adapter();
        JSObject response = new JSObject();
        response.put("enabled", adapter != null && adapter.isEnabled());
        call.resolve(response);
    }

    @Override
    protected void handleOnDestroy() {
        printer.shutdownNow();
        watchdog.shutdownNow();
    }

    @SuppressLint("MissingPermission")
    private void send(PluginCall call, BluetoothDevice device, byte[] bytes) {
        AtomicReference<BluetoothSocket> current = new AtomicReference<>();
        AtomicBoolean timedOut = new AtomicBoolean(false);
        // Cerrar el socket desde otro hilo es la forma de cortar un connect() bloqueado.
        ScheduledFuture<?> connectTimer = watchdog.schedule(
            () -> {
                timedOut.set(true);
                closeQuietly(current.get());
            },
            CONNECT_TIMEOUT_MS,
            TimeUnit.MILLISECONDS
        );

        BluetoothSocket socket;
        try {
            socket = connect(device, current, timedOut);
        } catch (SecurityException e) {
            connectTimer.cancel(false);
            closeQuietly(current.get());
            call.reject("Sin permiso de Bluetooth.", "permission_denied");
            return;
        } catch (IOException e) {
            connectTimer.cancel(false);
            closeQuietly(current.get());
            call.reject("No se pudo conectar con la impresora.", "connect_failed");
            return;
        }
        connectTimer.cancel(false);

        ScheduledFuture<?> writeTimer = watchdog.schedule(() -> closeQuietly(socket), WRITE_TIMEOUT_MS, TimeUnit.MILLISECONDS);
        try {
            OutputStream out = socket.getOutputStream();
            for (int offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
                out.write(bytes, offset, Math.min(CHUNK_BYTES, bytes.length - offset));
                out.flush();
            }
            Thread.sleep(DRAIN_MS);
            call.resolve();
        } catch (IOException e) {
            call.reject("Se cortó la conexión con la impresora.", "write_failed");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            call.reject("Se interrumpió la impresión.", "write_failed");
        } finally {
            writeTimer.cancel(false);
            closeQuietly(socket);
        }
    }

    /** Primero la conexión segura; algunas impresoras solo aceptan la insegura. */
    @SuppressLint("MissingPermission")
    private BluetoothSocket connect(BluetoothDevice device, AtomicReference<BluetoothSocket> current, AtomicBoolean timedOut)
        throws IOException {
        try {
            current.set(device.createRfcommSocketToServiceRecord(SPP));
            current.get().connect();
            return current.get();
        } catch (IOException secure) {
            closeQuietly(current.get());
            if (timedOut.get()) {
                throw secure;
            }
            current.set(device.createInsecureRfcommSocketToServiceRecord(SPP));
            if (timedOut.get()) {
                throw secure;
            }
            current.get().connect();
            return current.get();
        }
    }

    /** El adaptador listo para usar; si no, rechaza la llamada con su código y devuelve null. */
    private BluetoothAdapter ready(PluginCall call) {
        BluetoothAdapter adapter = adapter();
        if (adapter == null) {
            call.reject("Este teléfono no tiene Bluetooth.", "unsupported");
            return null;
        }
        if (!hasPermission()) {
            call.reject("Sin permiso de Bluetooth.", "permission_denied");
            return null;
        }
        if (!adapter.isEnabled()) {
            call.reject("El Bluetooth está apagado.", "bluetooth_off");
            return null;
        }
        return adapter;
    }

    private BluetoothAdapter adapter() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return manager != null ? manager.getAdapter() : null;
    }

    private boolean hasPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || getPermissionState(PERMISSION) == PermissionState.GRANTED;
    }

    private static JSObject grantedResult() {
        JSObject result = new JSObject();
        result.put(PERMISSION, "granted");
        return result;
    }

    private static void closeQuietly(BluetoothSocket socket) {
        if (socket == null) {
            return;
        }
        try {
            socket.close();
        } catch (IOException ignored) {
            // Ya estaba cerrado.
        }
    }
}
