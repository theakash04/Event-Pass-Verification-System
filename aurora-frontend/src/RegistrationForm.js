import React, { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import axios from "axios";

const RegistrationForm = () => {
    const [formData, setFormData] = useState({
        name: "",
        rollNumber: "",
        email: "",
        purpose: "Volunteer",
        agreeToTerms: false,
    });
    const [photo, setPhoto] = useState(null);
    const [signature, setSignature] = useState(null);
    const [generatedPass, setGeneratedPass] = useState(null);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === "checkbox" ? checked : value,
        });
    };

    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        const maxSize = 2 * 1024 * 1024; // 2MB in bytes
        if (file.size > maxSize) {
            alert("The selected image is larger than 2MB. Please choose a smaller file.");
            e.target.value = ""; // Clear the file input
            return;
        } else {
            if (type === "photo") {
                setPhoto(file);
            } else if (type === "signature") {
                setSignature(file);
            }
        }

    };


    // This function generates a PDF from an element with the given id.
    async function generatePDF(elementId, options = {}) {
        // Default options: scale factor, simulated desktop width, and JPEG quality
        const { scale = 2, desiredWidth = 1440, quality = 0.7 } = options;
        const element = document.getElementById(elementId);
        if (!element) {
            return Promise.reject(new Error(`Element with id "${elementId}" not found.`));
        }

        // Use "windowWidth" to simulate a desktop viewport
        return html2canvas(element, { scale, windowWidth: desiredWidth }).then((canvas) => {
            // Convert the canvas to a JPEG image with the specified quality to reduce file size
            const imgData = canvas.toDataURL("image/jpeg", quality);
            const pdf = new jsPDF("p", "mm", "a4");

            // Get PDF dimensions in mm (A4 dimensions)
            const pdfWidth = pdf.internal.pageSize.getWidth();   // ~210 mm for A4
            const pdfHeight = pdf.internal.pageSize.getHeight();   // ~297 mm for A4

            // Compute the canvas aspect ratio
            const aspectRatio = canvas.height / canvas.width;

            // Set the image width to fill the entire PDF width and calculate the corresponding height
            let finalWidth = pdfWidth;
            let finalHeight = pdfWidth * aspectRatio;

            // If the image is too tall for the page, scale it down to fit within the page height
            if (finalHeight > pdfHeight) {
                const shrinkFactor = pdfHeight / finalHeight;
                finalWidth *= shrinkFactor;
                finalHeight *= shrinkFactor;
            }

            // Center the image on the PDF page by calculating the offsets
            const offsetX = (pdfWidth - finalWidth) / 2;
            const offsetY = (pdfHeight - finalHeight) / 2;
            pdf.addImage(imgData, "JPEG", offsetX, offsetY, finalWidth, finalHeight);

            return pdf.output("blob");
        });
    }

    useEffect(() => {
        if (generatedPass) {
            // Give React a moment to render the pass container.
            setTimeout(() => {
                generatePDF("passContainer", { scale: 2, desiredWidth: 1440, quality: 0.7 })
                    .then(async (pdfBlob) => {
                        // Build FormData
                        const data = new FormData();
                        data.append("pdf", pdfBlob, "Aurora25_Pass.pdf");
                        data.append("email", formData.email);
                        data.append("rollNumber", formData.rollNumber);


                        // Send as multipart/form-data
                        await axios.post(
                            `${process.env.REACT_APP_BACKEND_URL}/api/uploadPdf`,
                            data,
                            {
                                headers: {
                                    "Content-Type": "multipart/form-data",
                                },
                            }
                        );

                    })
                    .catch((error) => console.error("Error generating PDF:", error));
            }, 500); // Adjust delay if necessary
        }
    }, [generatedPass, formData.email, formData.rollNumber]);

    // First, handle the registration submission.
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.email.endsWith("@bitmesra.ac.in")) {
            alert("Only @bitmesra.ac.in emails are accepted!");
            return;
        }
        if (!formData.agreeToTerms) {
            alert("You must agree to the terms and conditions!");
            return;
        }
        try {
            // Send registration request
            const response = await axios.post(
                `${process.env.REACT_APP_BACKEND_URL}/api/register`,
                { ...formData }
            );
            const { serial } = response.data;
            // Set generatedPass state so the pass container renders.
            setGeneratedPass({ ...formData, serial });
        } catch (error) {
            const errorMsg =
                error.response?.data?.message || error.message || "An unknown error occurred";
            alert(errorMsg);
        }
    };

    const getRoleBadgeColor = (role) => {
        switch (role) {
            case "Volunteer":
                return "bg-red-500 text-white";
            case "Participant":
                return "bg-green-500 text-white";
            case "Visitor":
                return "bg-yellow-500 text-black";
            default:
                return "bg-gray-500 text-white";
        }
    };


    const downloadPDF = () => {
        const downloadBtn = document.getElementById("downloadBtn");
        downloadBtn.style.display = "none";
        generatePDF("passContainer")
            .then((pdfBlob) => {
                downloadBtn.style.display = "block";
                // Create an object URL for the Blob and trigger download
                const url = URL.createObjectURL(pdfBlob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "Aurora25_Pass.pdf";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            })
            .catch((error) => {
                downloadBtn.style.display = "block";
            });
    };

    return (
        <div className="min-h-screen max-w-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-200 to-gray-100 p-6">
            <div className="bg-white shadow-2xl rounded-xl p-8 max-w-lg w-full">
                <h1 className="text-4xl font-extrabold text-center mb-6 text-indigo-600">
                    Aurora'25 Registration
                </h1>
                {!generatedPass && (
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <input
                            name="name"
                            placeholder="Full Name"
                            onChange={handleChange}
                            required
                            className="w-full p-3 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <input
                            name="rollNumber"
                            placeholder="Roll Number"
                            onChange={handleChange}
                            required
                            className="w-full p-3 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <input
                            name="email"
                            type="email"
                            placeholder="College Email"
                            onChange={handleChange}
                            required
                            className="w-full p-3 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <select
                            name="purpose"
                            onChange={handleChange}
                            className="w-full p-3 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="Volunteer">Volunteer</option>
                            <option value="Participant">Participant</option>
                            <option value="Visitor">Visitor</option>
                        </select>
                        <div>
                            <label className="block font-medium">Upload Your Photo:</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, "photo")}
                                required
                                className="w-full mt-2 p-3 border rounded-lg shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block font-medium">Upload Your Signature:</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileChange(e, "signature")}
                                required
                                className="w-full mt-2 p-3 border rounded-lg shadow-sm"
                            />
                        </div>
                        <div className="flex items-start">
                            <input
                                type="checkbox"
                                name="agreeToTerms"
                                checked={formData.agreeToTerms}
                                onChange={handleChange}
                                className="mt-1"
                            />
                            <label className="ml-2 text-sm text-gray-700">
                                I hereby undertake to maintain discipline and follow all rules and regulations during Aurora 25. I understand that any misconduct may result in disciplinary action.
                            </label>
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-indigo-600 text-white py-3 rounded-lg shadow-lg hover:bg-indigo-700 transition duration-200"
                        >
                            Register
                        </button>
                    </form>)}

                {/* Render the pass container only after registration */}
                {generatedPass && (
                    <div
                        id="passContainer"
                        className="mt-10 bg-white border-2 border-gray-300 shadow-lg rounded-lg p-6 flex flex-col gap-4"
                    >
                        <h2 className="text-3xl font-bold text-indigo-800 text-center">
                            Welcome to Aurora'25
                        </h2>
                        <div className="flex sm:flex-row flex-col items-center justify-center gap-4 w-full">
                            <div className="max-w-28">
                                {photo && (
                                    <img
                                        src={URL.createObjectURL(photo)}
                                        alt="Uploaded"
                                        className="w-28 h-28 rounded-full border-4 border-indigo-500 shadow-md"
                                    />
                                )}
                            </div>
                            <div>
                                <p>
                                    <strong>Name:</strong> {generatedPass.name}
                                </p>
                                <p>
                                    <strong>Roll:</strong>{" "}
                                    <span className="text-sm">{generatedPass.rollNumber}</span>
                                </p>
                                <p
                                    className={`text-lg text-center font-medium px-3 py-1 rounded-lg mt-2 ${getRoleBadgeColor(
                                        generatedPass.purpose
                                    )}`}
                                >
                                    {generatedPass.purpose}
                                </p>
                            </div>
                            <QRCodeCanvas value={generatedPass.serial} size={100} />
                        </div>
                        {signature && (
                            <img
                                src={URL.createObjectURL(signature)}
                                alt="Signature"
                                className="w-32 mx-auto mt-3 border border-gray-300 shadow-sm"
                            />
                        )}
                        <div className="text-sm text-gray-600 text-center border-t pt-2 mt-3">
                            I hereby undertake to maintain discipline and follow all rules and regulations during Aurora 25. I understand that any misconduct may result in disciplinary action.
                        </div>
                        <button id="downloadBtn" onClick={downloadPDF} className="mt-3 p-2 bg-blue-600 text-white rounded" data-html2canvas-ignore="true">
                            Download Pass as PDF
                        </button>
                    </div>
                )}
            </div>
            <footer className="mt-5 font-semibold">
                By CSS | @theakash04
            </footer>
        </div>
    );
};

export default RegistrationForm;

