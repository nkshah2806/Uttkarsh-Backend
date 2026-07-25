const Product = require("../models/Product");

// GET /api/products
const getProducts = async (req, res) => {
  try {
    const { category, q, sort, bestseller, featured, min_price, max_price, ailment, limit } = req.query;

    const filter = {};

    if (category) {
      filter.category_slug = category;
    }
    if (bestseller === "true" || bestseller === true) {
      filter.is_bestseller = true;
    }
    if (featured === "true" || featured === true) {
      filter.is_featured = true;
    }
    if (ailment) {
      filter.ailment = { $regex: ailment, $options: "i" };
    }
    if (min_price || max_price) {
      filter.price = {};
      if (min_price) filter.price.$gte = Number(min_price);
      if (max_price) filter.price.$lte = Number(max_price);
    }
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { short_description: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { category_slug: { $regex: q, $options: "i" } },
      ];
    }

    let query = Product.find(filter);

    // Sorting
    if (sort === "price_asc") {
      query = query.sort({ price: 1 });
    } else if (sort === "price_desc") {
      query = query.sort({ price: -1 });
    } else if (sort === "newest") {
      query = query.sort({ createdAt: -1 });
    } else if (sort === "popular") {
      query = query.sort({ rating: -1, review_count: -1 });
    } else {
      query = query.sort({ is_featured: -1, is_bestseller: -1, createdAt: -1 });
    }

    if (limit) {
      query = query.limit(Number(limit));
    }

    const products = await query.exec();
    return res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({ message: "Failed to fetch products", error: error.message });
  }
};

// GET /api/products/:slug
const getProductBySlug = async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.json(product);
  } catch (error) {
    console.error("Error fetching product by slug:", error);
    return res.status(500).json({ message: "Failed to fetch product", error: error.message });
  }
};

// GET /api/products/:id/related
const getRelatedProducts = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      const fallback = await Product.find({}).limit(4);
      return res.json(fallback);
    }
    const related = await Product.find({
      category_slug: product.category_slug,
      _id: { $ne: product._id },
    }).limit(4);

    if (related.length < 4) {
      const additional = await Product.find({
        _id: { $ne: product._id, $nin: related.map((p) => p._id) },
      }).limit(4 - related.length);
      return res.json([...related, ...additional]);
    }

    return res.json(related);
  } catch (error) {
    console.error("Error fetching related products:", error);
    return res.status(500).json({ message: "Failed to fetch related products", error: error.message });
  }
};

// GET /api/products/:id/reviews
const getProductReviews = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.json(product.reviews || []);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return res.status(500).json({ message: "Failed to fetch reviews", error: error.message });
  }
};

// POST /api/products/:id/reviews
const addReview = async (req, res) => {
  try {
    const { user, rating, title, body } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    const newReview = {
      user: user || "Anonymous Customer",
      rating: Number(rating) || 5,
      title: title || "",
      body: body || "",
      date: new Date(),
    };
    product.reviews.push(newReview);
    product.review_count = product.reviews.length;

    const totalRating = product.reviews.reduce((acc, curr) => acc + curr.rating, 0);
    product.rating = Number((totalRating / product.reviews.length).toFixed(1));

    await product.save();
    return res.status(201).json(product);
  } catch (error) {
    console.error("Error adding review:", error);
    return res.status(500).json({ message: "Failed to add review", error: error.message });
  }
};

// POST /api/products
const createProduct = async (req, res) => {
  try {
    const { name, slug, category_slug, price, mrp } = req.body;
    if (!name || !slug || !category_slug || price == null || mrp == null) {
      return res.status(400).json({ message: "Name, Slug, Category Slug, Price and MRP are required." });
    }
    const existing = await Product.findOne({ slug });
    if (existing) {
      return res.status(400).json({ message: "Product with this slug already exists." });
    }
    const product = await Product.create(req.body);
    return res.status(201).json(product);
  } catch (error) {
    console.error("Error creating product:", error);
    return res.status(500).json({ message: "Failed to create product", error: error.message });
  }
};

// PUT /api/products/:id
const updateProduct = async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.json(updated);
  } catch (error) {
    console.error("Error updating product:", error);
    return res.status(500).json({ message: "Failed to update product", error: error.message });
  }
};

// DELETE /api/products/:id
const deleteProduct = async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    return res.status(500).json({ message: "Failed to delete product", error: error.message });
  }
};

module.exports = {
  getProducts,
  getProductBySlug,
  getRelatedProducts,
  getProductReviews,
  addReview,
  createProduct,
  updateProduct,
  deleteProduct,
};
