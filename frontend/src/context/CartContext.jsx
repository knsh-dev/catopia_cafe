import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "./AuthContext";

const CartContext = createContext(null);

const getCartStorageKey = (userId) => (userId ? `cart_${userId}` : `cart_guest`);

function readCartFromStorage(userId) {
  try {
    const key = getCartStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : []).map((item) => ({
      ...item,
      cartKey: item.cartKey || `${item.id}_${item.size || "std"}_${item.temperature || "std"}`,
      unitPrice: item.unitPrice != null ? parseFloat(item.unitPrice) : parseFloat(item.price || 0),
    }));
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const storageKey = getCartStorageKey(userId);

  // Track the active userId so state updates don't bleed across user switches
  const activeUserIdRef = useRef(userId);
  const [items, setItems] = useState(() => readCartFromStorage(userId));

  // React to user change (account switch, login, or logout)
  useEffect(() => {
    if (activeUserIdRef.current !== userId) {
      activeUserIdRef.current = userId;
      // Immediately load the active user's cart
      const userItems = readCartFromStorage(userId);
      setItems(userItems);
    }
  }, [userId]);

  // Clean up legacy un-namespaced cart if present in localStorage
  useEffect(() => {
    try {
      localStorage.removeItem("catopia_cart");
    } catch {}
  }, []);

  // Listen for global auth-change events
  useEffect(() => {
    const handleAuthChange = (e) => {
      const nextUser = e.detail?.user;
      const nextUserId = nextUser?.id ?? null;
      activeUserIdRef.current = nextUserId;
      setItems(readCartFromStorage(nextUserId));
    };

    window.addEventListener("catopia:auth-change", handleAuthChange);
    return () => window.removeEventListener("catopia:auth-change", handleAuthChange);
  }, []);

  // Persist to localStorage whenever items change for the CURRENT active user
  useEffect(() => {
    if (activeUserIdRef.current !== userId) {
      // Still in transition between users; do not write old items to new user's key!
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (e) {
      console.error("Failed to save cart to localStorage", e);
    }
  }, [items, userId, storageKey]);

  /**
   * Add item to cart with optional variants:
   * options: { size: "Regular" | "Grande", temperature: "Hot" | "Cold", unitPrice: number, quantity: number }
   */
  const addItem = useCallback((menuItem, options = {}) => {
    const size = options.size || (menuItem.enable_sizing ? "Regular" : "");
    const temperature = options.temperature || (menuItem.enable_temperature ? "Hot" : "");
    const qtyToAdd = options.quantity || 1;

    let unitPrice =
      options.unitPrice != null
        ? parseFloat(options.unitPrice)
        : parseFloat(menuItem.price || 0);

    // If unitPrice wasn't passed directly, calculate surcharges
    if (options.unitPrice == null) {
      if (size === "Grande" && menuItem.enable_sizing) unitPrice += 30;
      if (temperature === "Cold" && menuItem.enable_temperature) unitPrice += 30;
    }

    const cartKey = options.cartKey || `${menuItem.id}_${size || "std"}_${temperature || "std"}`;

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.cartKey === cartKey);
      if (existingIndex > -1) {
        return prev.map((i, idx) =>
          idx === existingIndex ? { ...i, quantity: i.quantity + qtyToAdd } : i
        );
      }
      return [
        ...prev,
        {
          cartKey,
          id: menuItem.id,
          name: menuItem.name,
          price: unitPrice,
          unitPrice,
          basePrice: parseFloat(menuItem.price || 0),
          size,
          temperature,
          image: menuItem.image,
          category: menuItem.category,
          quantity: qtyToAdd,
        },
      ];
    });
  }, []);

  const removeItem = useCallback((cartKeyOrId) => {
    setItems((prev) =>
      prev.filter((i) => i.cartKey !== cartKeyOrId && i.id !== cartKeyOrId)
    );
  }, []);

  const updateQuantity = useCallback((cartKeyOrId, quantity) => {
    if (quantity < 1) {
      setItems((prev) =>
        prev.filter((i) => i.cartKey !== cartKeyOrId && i.id !== cartKeyOrId)
      );
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.cartKey === cartKeyOrId || (i.cartKey == null && i.id === cartKeyOrId)
          ? { ...i, quantity }
          : i
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);

  const totalItems = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  );

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, i) => sum + parseFloat(i.unitPrice ?? i.price ?? 0) * i.quantity,
        0
      ),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      subtotal,
    }),
    [items, addItem, removeItem, updateQuantity, clearCart, totalItems, subtotal]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
