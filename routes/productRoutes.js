const express = require("express");
const {
  getProducts,
  getProductBySlug,
  getRelatedProducts,
  getProductReviews,
  addReview,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");

const router = express.Router();

router.get("/", getProducts);
router.get("/:slug", getProductBySlug);
router.get("/:id/related", getRelatedProducts);
router.get("/:id/reviews", getProductReviews);
router.post("/:id/reviews", addReview);
router.post("/", createProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

module.exports = router;
