import React, { useEffect, useState } from "react";
import { db } from "./firebaseConfig";
import { jsPDF } from "jspdf";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  addDoc,
  deleteDoc,
} from "firebase/firestore";

const App = () => {
  const [productos, setProductos] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [cantidades, setCantidades] = useState({});
  const [dineroRecibido, setDineroRecibido] = useState("");
  const [cambio, setCambio] = useState(null);
  const [stockModificar, setStockModificar] = useState({});
  const [ventasDiarias, setVentasDiarias] = useState([]);
  const [totalVenta, setTotalVenta] = useState(0);

  const [nuevoProducto, setNuevoProducto] = useState({
    nombre: "",
    precio: "",
    stock: "",
  });
  useEffect(() => {
    let total = 0;
    productosSeleccionados.forEach((id) => {
      const producto = productos.find((p) => p.id === id);
      const cantidad = parseInt(cantidades[id] || 1);
      if (producto) {
        total += cantidad * producto.precio;
      }
    });
    setTotalVenta(total);
  }, [productosSeleccionados, cantidades, productos]); // Agregar 'productos'
  
  
  const cargarVentasDiarias = async () => {
    const hoy = new Date().toISOString().split("T")[0]; // Fecha en formato YYYY-MM-DD
    const querySnapshot = await getDocs(collection(db, "Ventas"));
  
    const ventasHoy = [];
    querySnapshot.forEach((doc) => {
      const venta = doc.data();
      const fechaVenta = new Date(venta.fecha).toISOString().split("T")[0];
  
      if (fechaVenta === hoy) {
        ventasHoy.push({ id: doc.id, ...venta });
      }
    });
  
    setVentasDiarias(ventasHoy);
  };
  
    const manejarSeleccionProducto = (id) => {
    if (productosSeleccionados.includes(id)) {
      setProductosSeleccionados(productosSeleccionados.filter((p) => p !== id));
    } else {
      setProductosSeleccionados([...productosSeleccionados, id]);
    }
    };
  
  useEffect(() => {
    const obtenerProductos = async () => {
      const productosRef = collection(db, "Productos");
      const snapshot = await getDocs(productosRef);
      const productosLista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProductos(productosLista);
    };

    const obtenerVentas = async () => {
      const ventasRef = collection(db, "Ventas");
      const snapshot = await getDocs(ventasRef);
      const ventasLista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setVentas(ventasLista);
    };

    obtenerProductos();
    obtenerVentas();
  }, []);

  const manejarVenta = async () => {
    if (productosSeleccionados.length === 0) return;
  
    let totalPagar = 0;
    let productosActualizados = [...productos];
  
    for (let id of productosSeleccionados) {
      const producto = productos.find((p) => p.id === id);
      const cantidad = parseInt(cantidades[id] || 1);
  
      if (!producto || producto.stock < cantidad) {
        alert(`Stock insuficiente para ${producto?.nombre}`);
        return;
      }
  
      totalPagar += cantidad * producto.precio;
      productosActualizados = productosActualizados.map((p) =>
        p.id === id ? { ...p, stock: p.stock - cantidad } : p
      );
    }
  
    const dinero = parseFloat(dineroRecibido);
    if (isNaN(dinero) || dinero < totalPagar) {
      alert("Dinero insuficiente");
      return;
    }
  
    setCambio(dinero - totalPagar);
  
    // Actualizar stock en la base de datos
    for (let id of productosSeleccionados) {
      const producto = productos.find((p) => p.id === id);
      const cantidad = parseInt(cantidades[id] || 1);
      const productoRef = doc(db, "Productos", id);
      await updateDoc(productoRef, { stock: producto.stock - cantidad });
    }
  
    // Registrar venta en Firestore
    const nuevaVenta = {
      productos: productosSeleccionados.map((id) => ({
        nombre: productos.find((p) => p.id === id).nombre,
        cantidad: parseInt(cantidades[id] || 1),
        precio: productos.find((p) => p.id === id).precio,
      })),
      total: totalPagar,
      fecha: new Date().toISOString(),
    };
  
    const docRef = await addDoc(collection(db, "Ventas"), nuevaVenta);
    setVentas((prev) => [...prev, { id: docRef.id, ...nuevaVenta }]);
    setProductos(productosActualizados);
    setProductosSeleccionados([]);
    setCantidades({});
    alert("Venta realizada con éxito");
  
    generarFacturaPDF(nuevaVenta);
  };
   
  const eliminarVenta = async (id) => {
    await deleteDoc(doc(db, "Ventas", id));
    setVentas((prev) => prev.filter((venta) => venta.id !== id));
    alert("Venta eliminada del historial");
};

const limpiarHistorialVentas = async () => {
    const confirmacion = window.confirm("¿Estás seguro de eliminar todo el historial?");
    if (confirmacion) {
      const ventasRef = collection(db, "Ventas");
      const snapshot = await getDocs(ventasRef);
      snapshot.docs.forEach(async (venta) => {
        await deleteDoc(doc(db, "Ventas", venta.id));
      });
      setVentas([]);
      alert("Historial de ventas limpiado con éxito");
    }
};

  const modificarStock = async (id, cantidad, operacion) => {
    const producto = productos.find((p) => p.id === id);
    if (!producto || !cantidad || cantidad <= 0) return;

    let nuevoStock = operacion === "añadir" 
      ? producto.stock + parseInt(cantidad) 
      : producto.stock - parseInt(cantidad);

    if (nuevoStock < 0) {
      alert("No puedes reducir más stock del disponible");
      return;
    }

    const productoRef = doc(db, "Productos", id);
    await updateDoc(productoRef, { stock: nuevoStock });

    setProductos((prev) => prev.map((p) => p.id === id ? { ...p, stock: nuevoStock } : p));
    setStockModificar({ ...stockModificar, [id]: "" });
    alert(`Stock ${operacion === "añadir" ? "aumentado" : "reducido"} con éxito`);
  };

  const eliminarProducto = async (id) => {
    await deleteDoc(doc(db, "Productos", id));
    setProductos((prev) => prev.filter((producto) => producto.id !== id));
    alert("Producto eliminado del inventario");
  };

  const manejarAgregarProducto = async (e) => {
    e.preventDefault();
    if (!nuevoProducto.nombre || !nuevoProducto.precio || !nuevoProducto.stock) {
      alert("Completa todos los campos");
      return;
    }

    const productoData = {
      nombre: nuevoProducto.nombre,
      precio: parseFloat(nuevoProducto.precio),
      stock: parseInt(nuevoProducto.stock),
    };

    const docRef = await addDoc(collection(db, "Productos"), productoData);
    setProductos([...productos, { id: docRef.id, ...productoData }]);
    setNuevoProducto({ nombre: "", precio: "", stock: "" });
    alert("Producto agregado con éxito");
  };

  const generarFacturaPDF = (venta) => {
    const doc = new jsPDF();
    doc.text("Factura de Venta", 20, 20);
    doc.text(`Fecha: ${new Date(venta.fecha).toLocaleString()}`, 20, 30);
  
    let y = 40;
    venta.productos.forEach((p) => {
      doc.text(`${p.nombre} - ${p.cantidad} unidades - $${p.precio * p.cantidad}`, 20, y);
      y += 10;
    });
  
    doc.text(`Total: $${venta.total}`, 20, y + 10);
    doc.save(`Factura_Venta.pdf`);
  };
  
  const generarReporteDiario = () => {
    if (ventasDiarias.length === 0) {
      alert("No hay ventas registradas hoy.");
      return;
    }
  
    const doc = new jsPDF();
    doc.text("📊 Reporte Diario de Ventas", 20, 20);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 30);
  
    let y = 40;
    let totalGeneral = 0;
    const resumenProductos = {};
  
    ventasDiarias.forEach((venta) => {
      venta.productos.forEach((producto) => {
        if (!resumenProductos[producto.nombre]) {
          resumenProductos[producto.nombre] = { cantidad: 0, total: 0 };
        }
        resumenProductos[producto.nombre].cantidad += producto.cantidad;
        resumenProductos[producto.nombre].total += producto.cantidad * producto.precio;
      });
    });
  
    doc.text("📌 Resumen de Ventas por Producto:", 20, y);
    y += 10;
  
    Object.keys(resumenProductos).forEach((nombre) => {
      const producto = resumenProductos[nombre];
      doc.text(`${nombre}: ${producto.cantidad} unidades - Total: $${producto.total}`, 20, y);
      y += 10;
      totalGeneral += producto.total;
    });
  
    doc.text(`🔹 Total de Ventas del Día: $${totalGeneral}`, 20, y + 10);
    doc.save(`Reporte_Ventas_${new Date().toISOString().split("T")[0]}.pdf`);
  };
  

  return (
    <div>
      <h2>Inventario</h2>
      <ul>
        {productos.map((producto) => (
          <li key={producto.id}>
            {producto.nombre} - ${producto.precio} - Stock: {producto.stock}
            <input
              type="number"
              placeholder="Modificar stock"
              value={stockModificar[producto.id] || ""}
              onChange={(e) => setStockModificar({ ...stockModificar, [producto.id]: e.target.value })}
            />
            <button onClick={() => modificarStock(producto.id, stockModificar[producto.id], "añadir")}>➕ Añadir</button>
            <button onClick={() => modificarStock(producto.id, stockModificar[producto.id], "reducir")}>➖ Quitar</button>
            <button onClick={() => eliminarProducto(producto.id)}>❌ Eliminar</button>
          </li>
        ))}
      </ul>

      <h2>Registrar Venta</h2>
        <ul>
        {productos.map((producto) => (
         <li key={producto.id}>
          <input
           type="checkbox"
            onChange={() => manejarSeleccionProducto(producto.id)}
            checked={productosSeleccionados.includes(producto.id)}
         />
      {producto.nombre} - ${producto.precio} - Stock: {producto.stock}
      <input
        type="number"
        placeholder="Cantidad"
        min="1"
        value={cantidades[producto.id] || ""}
        onChange={(e) =>
          setCantidades({ ...cantidades, [producto.id]: e.target.value })
        }
        disabled={!productosSeleccionados.includes(producto.id)}
      />
    </li>
  ))}
</ul>

       <input
        type="number"
        placeholder="Dinero recibido"
        value={dineroRecibido}
        onChange={(e) => setDineroRecibido(e.target.value)}
      />
         <p>Total a pagar: ${totalVenta.toFixed(2)}</p>
         <button onClick={manejarVenta}>🛒 Vender</button>
        {cambio !== null && <p>Cambio a devolver: ${cambio.toFixed(2)}</p>}

<h2>📅 Historial de Ventas del Día</h2>
     <button onClick={cargarVentasDiarias}>🔄 Cargar Historial</button>
  <ul>
    {ventasDiarias.map((venta) => (
     <li key={venta.id}>
      <p>🛒 Venta realizada el {new Date(venta.fecha).toLocaleString()}</p>
      <ul>
           {venta.productos.map((producto, index) => (
          <li key={index}>
            {producto.nombre} - {producto.cantidad} unidades - ${producto.precio * producto.cantidad}
          </li>
         ))}
       </ul>
     </li>
   ))}
  </ul>

    <button onClick={generarReporteDiario}>📄 Descargar Reporte en PDF</button>

      <h2>Historial de Ventas</h2>
          <button onClick={limpiarHistorialVentas} style={{ marginBottom: "10px" }}>🗑️ Limpiar Historial</button>
           <ul>
           {ventas.map((venta) => (
             <li key={venta.id}>
                {new Date(venta.fecha).toLocaleString()} - {venta.producto} - {venta.cantidad} unidades - Total: ${venta.precioTotal}
                <button onClick={() => generarFacturaPDF(venta)}>📄 Descargar Factura</button>
                <button onClick={() => eliminarVenta(venta.id)} style={{ marginLeft: "5px", color: "red" }}>❌ Eliminar</button>
             </li>
                ))}
           </ul>


    <h2>Agregar Producto</h2>
       <form onSubmit={manejarAgregarProducto}>
          <input type="text" placeholder="Nombre" value={nuevoProducto.nombre} onChange={(e) => setNuevoProducto({ ...nuevoProducto, nombre: e.target.value })} />
          <input type="number" placeholder="Precio" value={nuevoProducto.precio} onChange={(e) => setNuevoProducto({ ...nuevoProducto, precio: e.target.value })} />
          <input type="number" placeholder="Stock" value={nuevoProducto.stock} onChange={(e) => setNuevoProducto({ ...nuevoProducto, stock: e.target.value })} />
          <button type="submit">➕ Agregar Producto</button>
      </form>
    </div>
   
  );
};

export default App;