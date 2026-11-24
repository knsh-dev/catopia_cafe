import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { formatPHP } from "@/lib/format";
import { getMenuItemImageUrl } from "@/lib/menuImages";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Star,
  Check,
  ShoppingBag,
  Sparkles,
  Coffee,
  Minus,
  Plus,
  ShieldCheck,
  MessageSquare,
  Clock,
  Flame,
  Snowflake,
  LogIn,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";

// Curated high-res imagery matching the cozy cafe reference design
const ITEM_IMAGES = {
  "Catpuccino": "https://images.unsplash.com/photo-1534778101976-62847782c213?w=800&auto=format&fit=crop&q=80",
  "Purrista Latte": "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=800&auto=format&fit=crop&q=80",
  "Meow-cha Espresso": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80",
  "Whisker Brew": "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=800&auto=format&fit=crop&q=80",
  "Paw Cat Latte": "https://images.unsplash.com/photo-1534778101976-62847782c213?w=800&auto=format&fit=crop&q=80",
  "Chai Purrfection": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&auto=format&fit=crop&q=80",
  "Matcha Kitty": "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=800&auto=format&fit=crop&q=80",
  "Berry Paws Iced Tea": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&auto=format&fit=crop&q=80",
  "Hot Chocolate Tabby": "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=800&auto=format&fit=crop&q=80",
  "Cat-shaped Croissant": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&auto=format&fit=crop&q=80",
  "Butter Croissant": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&auto=format&fit=crop&q=80",
  "Paw Print Cookie": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&auto=format&fit=crop&q=80",
  "Catnip Muffin": "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=800&auto=format&fit=crop&q=80",
  "Cinnamon Roll": "https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=800&auto=format&fit=crop&q=80",
  "Tuna Melt Panini": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&auto=format&fit=crop&q=80",
  "Kitty Caprese Salad": "https://images.unsplash.com/photo-1592417817098-8f3d6910985c?w=800&auto=format&fit=crop&q=80",
  "Salmon Paw Rice Bowl": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80",
  "Egg Toast": "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&auto=format&fit=crop&q=80",
  "Catopia Tote Bag": "https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop&q=80",
  "Paw Print Mug": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80",
  "Cat Ear Headband": "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=800&auto=format&fit=crop&q=80",
  "Cat Plush Toy": "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800&auto=format&fit=crop&q=80",
};

const CATEGORY_FALLBACK_IMAGES = {
  coffee: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop&q=80",
  non_coffee_tea: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&auto=format&fit=crop&q=80",
  pastries: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&auto=format&fit=crop&q=80",
  light_bites: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&auto=format&fit=crop&q=80",
  merch: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop&q=80",
};

export default function MenuItemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Customization options state
  const [selectedSize, setSelectedSize] = useState("Regular");
  const [selectedTemp, setSelectedTemp] = useState("Hot");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [ratingInput, setRatingInput] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [headlineInput, setHeadlineInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState("");
  const [reviewErrorMsg, setReviewErrorMsg] = useState("");

  const reviewsSectionRef = useRef(null);

  // Fetch Item Details
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    api
      .get(`/api/menu/items/${id}/`)
      .then((data) => {
        if (isMounted) {
          setItem(data);
          // Set default temperature to Cold if category is tea/beverage where cold is common
          if (data.enable_temperature) {
            setSelectedTemp("Hot");
          }
          if (data.enable_sizing) {
            setSelectedSize("Regular");
          }
        }
      })
      .catch(() => {
        if (isMounted) setError("Item not found or unavailable.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Fetch Reviews
  const fetchReviews = () => {
    setReviewsLoading(true);
    api
      .get(`/api/menu/reviews/?menu_item=${id}`)
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.results || [];
        setReviews(list);
      })
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  };

  useEffect(() => {
    fetchReviews();
  }, [id]);

  // Price calculations
  const basePrice = parseFloat(item?.price || 0);
  const sizeSurcharge = selectedSize === "Grande" && item?.enable_sizing ? 30 : 0;
  const tempSurcharge = selectedTemp === "Cold" && item?.enable_temperature ? 30 : 0;
  const unitPrice = basePrice + sizeSurcharge + tempSurcharge;
  const totalPrice = unitPrice * quantity;

  const isSoldOut = !item?.is_available || (item?.stock_quantity != null && item.stock_quantity <= 0);

  const handleAddToCart = () => {
    if (isSoldOut || !item) return;

    addItem(item, {
      size: item.enable_sizing ? selectedSize : "",
      temperature: item.enable_temperature ? selectedTemp : "",
      unitPrice,
      quantity,
    });

    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate(`/login?redirect=/menu/${id}`);
      return;
    }

    setSubmittingReview(true);
    setReviewSuccessMsg("");
    setReviewErrorMsg("");

    try {
      await api.post("/api/menu/reviews/", {
        menu_item: parseInt(id, 10),
        rating: ratingInput,
        headline: headlineInput.trim(),
        comment: commentInput.trim(),
      });

      setReviewSuccessMsg("Thank you! Your review has been saved.");
      setHeadlineInput("");
      setCommentInput("");
      fetchReviews();

      // Refresh item to update avg_rating & review_count
      api.get(`/api/menu/items/${id}/`).then((data) => setItem(data)).catch(() => {});
    } catch (err) {
      setReviewErrorMsg(err?.data?.detail || "Failed to submit review. Please try again.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const scrollToReviews = () => {
    reviewsSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const imageSrc = getMenuItemImageUrl(item);

  // Category label
  const categoryLabel =
    item?.category_detail?.name ||
    (item?.category ? item.category.replace("_", " ") : "Café Item");

  // Breakdown percentages
  const totalReviewsCount = item?.review_count || reviews.length;
  const breakdownCounts = item?.rating_breakdown || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  if (loading) {
    return (
      <div className="bg-cream min-h-screen py-10">
        <div className="mx-auto max-w-[var(--container-lg)] px-4 md:px-6 space-y-8">
          <Skeleton className="h-6 w-32" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <Skeleton className="aspect-[4/3] rounded-3xl w-full" />
            <div className="space-y-4">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-12 w-full rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-cream px-4">
        <div className="text-center space-y-4 max-w-md">
          <Coffee className="h-16 w-16 text-muted-foreground mx-auto" />
          <h1 className="font-heading text-2xl font-bold text-espresso">Treat Not Found</h1>
          <p className="text-muted-foreground text-sm">
            This menu item may have been relocated or taken off the active menu.
          </p>
          <Button asChild className="rounded-full bg-caramel hover:bg-caramel-dark text-white">
            <Link to="/menu">Back to Menu</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cream min-h-screen relative overflow-hidden py-8 md:py-12">
      {/* Warm ambient background glows */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-caramel/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute top-40 right-0 w-[450px] h-[450px] bg-blush/25 rounded-full blur-3xl pointer-events-none translate-x-1/3 -translate-y-1/4" />

      <div className="mx-auto max-w-[var(--container-lg)] px-4 md:px-6 relative z-10 space-y-12">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="rounded-full text-espresso/80 hover:text-espresso hover:bg-latte/50 -ml-2"
          >
            <Link to="/menu" className="flex items-center gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Menu</span>
            </Link>
          </Button>

          <Link
            to="/menu"
            className="text-xs text-caramel font-semibold hover:underline flex items-center gap-1"
          >
            <span>Explore All Drinks & Pastries</span>
          </Link>
        </div>

        {/* Top Product Showcase (Two Columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Image Card */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative aspect-[4/3] sm:aspect-square w-full rounded-3xl overflow-hidden bg-latte/30 border border-[#F2ECE4] shadow-[0_8px_30px_rgba(61,43,31,0.08)] flex items-center justify-center">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={item.name}
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                />
              ) : (
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  No Image
                </span>
              )}

              {/* Badge Tag Overlay */}
              {item.badge_tag && (
                <div className="absolute top-4 left-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-caramel text-white text-xs font-semibold shadow-md">
                    <Sparkles className="h-3 w-3" />
                    {item.badge_tag}
                  </span>
                </div>
              )}

              {/* Sold out overlay */}
              {isSoldOut && (
                <div className="absolute inset-0 flex items-center justify-center bg-espresso/60 backdrop-blur-[2px]">
                  <span className="text-white text-sm font-bold px-4 py-1.5 rounded-full bg-destructive shadow-md">
                    Currently Sold Out
                  </span>
                </div>
              )}
            </div>

            {/* Micro perks bar */}
            <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground pt-1">
              <div className="p-2.5 rounded-2xl bg-white/70 border border-border/60">
                <p className="font-semibold text-espresso">Freshly Prepared</p>
                <p className="text-[10px]">Made to order</p>
              </div>
              <div className="p-2.5 rounded-2xl bg-white/70 border border-border/60">
                <p className="font-semibold text-espresso">Café Pickup</p>
                <p className="text-[10px]">Ready in 10-15m</p>
              </div>
              <div className="p-2.5 rounded-2xl bg-white/70 border border-border/60">
                <p className="font-semibold text-espresso">Earn Points</p>
                <p className="text-[10px] text-caramel font-medium">10% back</p>
              </div>
            </div>
          </div>

          {/* Right Column: Item Information & Customization */}
          <div className="lg:col-span-6 space-y-6">
            {/* Category & Rating */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-caramel/10 text-caramel tracking-wide uppercase">
                  {categoryLabel}
                </span>

                {/* Stock Level Badge */}
                {item.is_available && item.stock_quantity > 0 && item.stock_quantity < 10 && (
                  <span className="text-xs text-amber-800 bg-amber-500/10 px-2.5 py-0.5 rounded-full font-semibold border border-amber-500/20 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Only {item.stock_quantity} left
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="font-heading text-3xl sm:text-4xl font-bold text-espresso tracking-tight">
                {item.name}
              </h1>

              {/* Rating summary */}
              <button
                type="button"
                onClick={scrollToReviews}
                className="inline-flex items-center gap-2 text-xs sm:text-sm text-espresso/80 hover:text-caramel transition-colors group cursor-pointer"
              >
                <div className="flex items-center text-amber-500">
                  <Star className="h-4 w-4 fill-amber-500" />
                  <span className="font-bold text-espresso ml-1 text-sm">
                    {item.avg_rating > 0 ? item.avg_rating.toFixed(1) : "New"}
                  </span>
                </div>
                <span className="text-muted-foreground group-hover:underline">
                  ({totalReviewsCount} {totalReviewsCount === 1 ? "review" : "reviews"})
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-caramel font-medium group-hover:underline">
                  Read Reviews
                </span>
              </button>
            </div>

            {/* Price display with live update */}
            <div className="flex items-baseline gap-3">
              <span className="font-heading text-3xl sm:text-4xl font-bold text-caramel tabular-nums">
                {formatPHP(unitPrice)}
              </span>
              {(sizeSurcharge > 0 || tempSurcharge > 0) && (
                <span className="text-xs text-muted-foreground line-through tabular-nums">
                  {formatPHP(basePrice)}
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {item.description ||
                "Handcrafted by our resident baristas with the finest ingredients and extra cozy warmth."}
            </p>

            {/* Stamp Card qualification */}
            {item.qualifies_for_stamps && (
              <div className="rounded-2xl bg-caramel/10 border border-caramel/25 p-3 flex items-center gap-2.5 text-xs text-espresso">
                <span className="text-base">🐾</span>
                <span>
                  <strong>Stamp Card Qualifying:</strong> Earns 1 stamp toward your Free Drink or Pastry treat!
                </span>
              </div>
            )}

            <Separator className="bg-border/60" />

            {/* Customization Options */}
            <div className="space-y-5">
              {/* Size Selector */}
              {item.enable_sizing && (
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-espresso">Cup Size</span>
                    <span className="text-muted-foreground text-[11px]">
                      {selectedSize === "Grande" ? "Grande (+₱30.00)" : "Regular (Standard)"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedSize("Regular")}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedSize === "Regular"
                          ? "bg-caramel/10 border-caramel text-espresso shadow-xs font-semibold"
                          : "bg-white border-border/80 text-muted-foreground hover:border-caramel/40"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-sm font-semibold text-espresso">Regular</span>
                        <span className="text-xs font-medium text-caramel">+₱0.00</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Standard 12oz cup</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedSize("Grande")}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedSize === "Grande"
                          ? "bg-caramel/10 border-caramel text-espresso shadow-xs font-semibold"
                          : "bg-white border-border/80 text-muted-foreground hover:border-caramel/40"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-sm font-semibold text-espresso">Grande</span>
                        <span className="text-xs font-medium text-caramel">+₱30.00</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Upsized 16oz cup</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Temperature Selector */}
              {item.enable_temperature && (
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-espresso">Temperature</span>
                    <span className="text-muted-foreground text-[11px]">
                      {selectedTemp === "Cold" ? "Iced (+₱30.00)" : "Hot (Standard)"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedTemp("Hot")}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        selectedTemp === "Hot"
                          ? "bg-caramel/10 border-caramel text-espresso shadow-xs font-semibold"
                          : "bg-white border-border/80 text-muted-foreground hover:border-caramel/40"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Flame className="h-4 w-4 text-amber-600" />
                        <div>
                          <p className="text-sm font-semibold text-espresso">Hot</p>
                          <p className="text-[11px] text-muted-foreground">Fresh steamed</p>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-caramel">+₱0.00</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedTemp("Cold")}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        selectedTemp === "Cold"
                          ? "bg-caramel/10 border-caramel text-espresso shadow-xs font-semibold"
                          : "bg-white border-border/80 text-muted-foreground hover:border-caramel/40"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Snowflake className="h-4 w-4 text-sky-600" />
                        <div>
                          <p className="text-sm font-semibold text-espresso">Iced / Cold</p>
                          <p className="text-[11px] text-muted-foreground">Chilled with ice</p>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-caramel">+₱30.00</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Quantity Stepper & Add to Cart button */}
              <div className="pt-2 space-y-4">
                <div className="flex items-center gap-4">
                  {/* Quantity Stepper */}
                  <div className="flex items-center border border-border/80 rounded-full bg-white p-1">
                    <button
                      type="button"
                      disabled={quantity <= 1 || isSoldOut}
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="h-9 w-9 rounded-full flex items-center justify-center text-espresso hover:bg-latte transition-colors disabled:opacity-40 cursor-pointer"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-10 text-center font-bold text-espresso tabular-nums text-sm">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      disabled={isSoldOut || (item.stock_quantity != null && quantity >= item.stock_quantity)}
                      onClick={() => setQuantity((q) => q + 1)}
                      className="h-9 w-9 rounded-full flex items-center justify-center text-espresso hover:bg-latte transition-colors disabled:opacity-40 cursor-pointer"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Main CTA: Warm amber button */}
                  <Button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={isSoldOut}
                    className={`flex-1 rounded-full py-6 text-base font-semibold shadow-md transition-all cursor-pointer flex items-center justify-between px-6 ${
                      added
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-caramel hover:bg-caramel-dark text-white"
                    }`}
                  >
                    {added ? (
                      <span className="flex items-center gap-2 mx-auto">
                        <Check className="h-5 w-5" /> Added to Cart!
                      </span>
                    ) : isSoldOut ? (
                      <span className="mx-auto">Sold Out</span>
                    ) : (
                      <>
                        <span className="flex items-center gap-2">
                          <ShoppingBag className="h-4.5 w-4.5" />
                          <span>Add to Cart</span>
                        </span>
                        <span className="font-bold tabular-nums">
                          {formatPHP(totalPrice)}
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Reviews & Ratings Section */}
        <section ref={reviewsSectionRef} className="pt-8 border-t border-border/60 space-y-8">
          <div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-espresso">
              Customer Reviews & Ratings
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Read authentic feedback from fellow cat lovers and verified café visitors.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Overall Rating & Breakdown */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="rounded-3xl border-border/80 bg-white p-6 shadow-sm space-y-6">
                <div className="flex items-center gap-6">
                  {/* Big Score */}
                  <div className="text-center">
                    <p className="font-heading text-5xl font-extrabold text-espresso">
                      {item.avg_rating > 0 ? item.avg_rating.toFixed(1) : "0.0"}
                    </p>
                    <div className="flex items-center justify-center text-amber-500 mt-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-4 w-4 ${
                            s <= Math.round(item.avg_rating)
                              ? "fill-amber-500 text-amber-500"
                              : "text-amber-200 fill-amber-100"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {totalReviewsCount} {totalReviewsCount === 1 ? "review" : "reviews"}
                    </p>
                  </div>

                  {/* Star breakdown bars */}
                  <div className="flex-1 space-y-1.5 text-xs">
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const count = breakdownCounts[stars] || 0;
                      const pct = totalReviewsCount > 0 ? Math.round((count / totalReviewsCount) * 100) : 0;
                      return (
                        <div key={stars} className="flex items-center gap-2">
                          <span className="w-3 text-muted-foreground font-medium">{stars}</span>
                          <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                          <div className="flex-1 h-2 rounded-full bg-latte/60 overflow-hidden">
                            <div
                              className="h-full bg-caramel rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-[11px] text-muted-foreground tabular-nums">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-status-paid">
                    <ShieldCheck className="h-4 w-4" /> Verified order ratings
                  </span>
                  <span>100% genuine guests</span>
                </div>
              </Card>

              {/* Write a review card */}
              <Card className="rounded-3xl border-border/80 bg-white p-6 shadow-sm">
                {user ? (
                  <form onSubmit={handleReviewSubmit} className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="font-heading font-bold text-lg text-espresso">
                        Share Your Experience
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        How did you enjoy the {item.name}?
                      </p>
                    </div>

                    {/* Star selector */}
                    <div>
                      <label className="text-xs font-semibold text-espresso block mb-1.5">
                        Your Rating *
                      </label>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            type="button"
                            key={star}
                            onClick={() => setRatingInput(star)}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            className="p-1 text-amber-500 transition-transform hover:scale-110 cursor-pointer"
                            aria-label={`Rate ${star} star`}
                          >
                            <Star
                              className={`h-6 w-6 ${
                                star <= (hoverRating || ratingInput)
                                  ? "fill-amber-500 text-amber-500"
                                  : "text-amber-200 fill-amber-50"
                              }`}
                            />
                          </button>
                        ))}
                        <span className="ml-2 text-xs font-bold text-espresso">
                          {ratingInput} / 5 stars
                        </span>
                      </div>
                    </div>

                    {/* Headline */}
                    <div>
                      <label className="text-xs font-semibold text-espresso block mb-1">
                        Headline
                      </label>
                      <input
                        type="text"
                        value={headlineInput}
                        onChange={(e) => setHeadlineInput(e.target.value)}
                        placeholder="e.g. Incredibly creamy with cute latte art!"
                        className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none focus:ring-1 focus:ring-caramel"
                      />
                    </div>

                    {/* Comment */}
                    <div>
                      <label className="text-xs font-semibold text-espresso block mb-1">
                        Review Details
                      </label>
                      <textarea
                        rows={3}
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        placeholder="Share your thoughts on temperature, flavor, sweetness, or café vibes..."
                        className="w-full py-2 px-3 rounded-2xl border border-border bg-[#FAF6F0] focus:bg-white text-espresso text-xs focus:outline-none focus:ring-1 focus:ring-caramel resize-none"
                      />
                    </div>

                    {reviewSuccessMsg && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>{reviewSuccessMsg}</span>
                      </div>
                    )}

                    {reviewErrorMsg && (
                      <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{reviewErrorMsg}</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={submittingReview}
                      className="w-full rounded-full bg-caramel hover:bg-caramel-dark text-white text-xs font-semibold shadow-xs cursor-pointer"
                    >
                      {submittingReview ? "Submitting..." : "Submit Review"}
                    </Button>
                  </form>
                ) : (
                  <div className="text-center py-6 space-y-3">
                    <MessageSquare className="h-10 w-10 text-caramel/50 mx-auto" />
                    <h3 className="font-heading font-semibold text-base text-espresso">
                      Have you tasted this treat?
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Sign in to your Catopia account to leave a star rating and review.
                    </p>
                    <Button asChild size="sm" className="rounded-full bg-caramel text-white hover:bg-caramel-dark">
                      <Link to={`/login?redirect=/menu/${id}`}>
                        <LogIn className="h-3.5 w-3.5 mr-1.5" />
                        Sign In to Review
                      </Link>
                    </Button>
                  </div>
                )}
              </Card>
            </div>

            {/* Right: Review Feed */}
            <div className="lg:col-span-7 space-y-4">
              {reviewsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-3xl" />
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-border/80 space-y-3">
                  <Star className="h-12 w-12 text-caramel/40 mx-auto" />
                  <h3 className="font-heading font-semibold text-lg text-espresso">
                    No Reviews Yet
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Be the very first guest to review this drink or treat! Your feedback helps other cat enthusiasts choose their favorites.
                  </p>
                </div>
              ) : (
                reviews.map((rev) => (
                  <Card
                    key={rev.id}
                    className="rounded-3xl border-border/80 bg-white p-5 shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="h-9 w-9 rounded-full bg-latte text-espresso font-bold text-xs flex items-center justify-center shrink-0 border border-border">
                          {rev.user_initials || "CG"}
                        </div>
                        <div>
                          <p className="font-semibold text-espresso text-sm leading-tight">
                            {rev.user_name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(rev.created_at).toLocaleDateString("en-PH", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>

                      {/* Verified Order Badge */}
                      {rev.is_verified_order && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-800 border-emerald-500/30 text-[10px] gap-1 px-2 py-0.5"
                        >
                          <ShieldCheck className="h-3 w-3 text-emerald-600" />
                          Verified Order
                        </Badge>
                      )}
                    </div>

                    {/* Stars */}
                    <div className="flex items-center gap-1 text-amber-500">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3.5 w-3.5 ${
                            s <= rev.rating ? "fill-amber-500 text-amber-500" : "text-amber-200"
                          }`}
                        />
                      ))}
                    </div>

                    {/* Headline & Body */}
                    {rev.headline && (
                      <p className="font-heading font-bold text-espresso text-sm">
                        {rev.headline}
                      </p>
                    )}
                    {rev.comment && (
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                        {rev.comment}
                      </p>
                    )}
                  </Card>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
