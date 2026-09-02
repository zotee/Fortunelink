const express = require("express");
const router = express.Router();

const Client = require("../model/clientSchema"); // adjust path if needed

// 📌 CREATE CLIENT
router.post("/clients", async (req, res) => {
  try {
    const client = new Client(req.body);
    await client.save();

    res.status(201).json({
      message: "Client created successfully",
      data: client,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📌 GET ALL CLIENTS (only important fields)
router.get("/clients", async (req, res) => {
  try {
    const clients = await Client.find().select(
      "clientId fullName phone visaType coeStatus clientStatus createdAt"
    );

    res.json({
      count: clients.length,
      data: clients,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📌 GET SINGLE CLIENT
router.get("/clients/:id", async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📌 UPDATE CLIENT
router.put("/clients/:id", async (req, res) => {
  try {
    const updatedClient = await Client.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedClient) {
      return res.status(404).json({ message: "Client not found" });
    }

    res.json({
      message: "Client updated successfully",
      data: updatedClient,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📌 DELETE CLIENT
router.delete("/clients/:id", async (req, res) => {
  try {
    const deletedClient = await Client.findByIdAndDelete(req.params.id);

    if (!deletedClient) {
      return res.status(404).json({ message: "Client not found" });
    }

    res.json({
      message: "Client deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 