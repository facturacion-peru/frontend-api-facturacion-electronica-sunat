package app.comprobantedigital;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import app.comprobantedigital.printer.BluetoothPrinterPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins propios: se registran antes de crear el puente.
        registerPlugin(BluetoothPrinterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
