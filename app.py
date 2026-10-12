import streamlit as st
import pandas as pd

st.set_page_config(
    page_title="MarginMind",
    page_icon="📊",
    layout="wide",
)

st.title("📊 MarginMind")
st.subheader("Financial Integrity & Intelligence")

st.write(
    "Compare reported financial figures with "
    "results reconstructed from available records."
)

st.info(
    "A discrepancy is a signal for investigation, "
    "not proof of fraud."
)

st.sidebar.header("Company Information")

company = st.sidebar.text_input(
    "Company name",
    value="Demo Company",
)

reported_profit = st.number_input(
    "Reported profit (₹)",
    min_value=-1_000_000_000.0,
    max_value=1_000_000_000.0,
    value=2_600_000.0,
    step=10_000.0,
)

uploaded_file = st.file_uploader(
    "Upload financial transactions (CSV)",
    type=["csv"],
)

if uploaded_file is not None:

    try:
        df = pd.read_csv(uploaded_file)

        required = {
            "reference_id",
            "type",
            "amount",
        }

        if not required.issubset(df.columns):
            st.error(
                "CSV must contain reference_id, type and amount."
            )

        elif df.empty:
            st.error("The CSV contains no transactions.")

        else:
            df["amount"] = pd.to_numeric(
                df["amount"],
                errors="raise",
            )

            if df["amount"].isna().any():
                st.error("Transaction amounts cannot be empty.")

            elif (
                not df["type"].isin(["revenue", "expense"]).all()
            ):
                st.error(
                    "Transaction types must be revenue or expense."
                )

            elif (
                (df["amount"] < 0).any()
                or not df["amount"].map(
                    lambda x: pd.notna(x) and x < float("inf")
                ).all()
            ):
                st.error(
                    "Amounts must be finite and non-negative."
                )

            else:
                revenue = df.loc[
                    df["type"] == "revenue",
                    "amount",
                ].sum()

                expenses = df.loc[
                    df["type"] == "expense",
                    "amount",
                ].sum()

                reconstructed_profit = revenue - expenses

                difference = (
                    reported_profit - reconstructed_profit
                )

                st.divider()
                st.header("Financial Analysis")

                col1, col2, col3 = st.columns(3)

                col1.metric(
                    "Reported Profit",
                    f"₹{reported_profit:,.0f}",
                )

                col2.metric(
                    "Reconstructed Profit",
                    f"₹{reconstructed_profit:,.0f}",
                )

                col3.metric(
                    "Difference",
                    f"₹{difference:,.0f}",
                )

                if abs(difference) > 0.01:
                    st.warning(
                        "Review recommended: reported and "
                        "reconstructed profit differ."
                    )
                else:
                    st.success(
                        "The figures reconcile under the "
                        "current calculation assumptions."
                    )

                duplicates = df[
                    df["reference_id"].duplicated(keep=False)
                ]

                st.subheader("Transaction Records")
                st.dataframe(
                    df,
                    use_container_width=True,
                )

                st.subheader("Duplicate References")

                if duplicates.empty:
                    st.success(
                        "No duplicate reference IDs detected."
                    )
                else:
                    st.dataframe(
                        duplicates,
                        use_container_width=True,
                    )

                chart_data = pd.DataFrame({
                    "Category": ["Revenue", "Expenses"],
                    "Amount": [revenue, expenses],
                })

                st.subheader("Revenue vs Expenses")

                st.bar_chart(
                    chart_data.set_index("Category")
                )

                st.caption(
                    "This is a simplified reconstruction using "
                    "the supplied transactions. Missing records, "
                    "accounting adjustments and classification "
                    "differences can affect the result. A "
                    "discrepancy does not establish fraud."
                )

    except Exception:
        st.error(
            "Unable to analyse this file. Check the CSV format "
            "and ensure all amounts are valid numbers."
        )

else:
    st.info(
        "Upload a CSV to begin analysing the company's finances."
    )